using System.Collections.Concurrent;
using GiftShop.Api.Options;
using GiftShop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GiftShop.Api.Middleware;

/// <summary>
/// Write-behind cache for IP bans: in-memory dict for hot-path checks,
/// async background persistence to PostgreSQL.
/// </summary>
public static class AdminBanRegistry
{
    // Key = IP Address, Value = when the 24-hour ban expires (UTC)
    public static readonly ConcurrentDictionary<string, DateTime> IpBanExpiry = new(StringComparer.OrdinalIgnoreCase);

    // Attempts tracker: resets on success. Key = IP, Value = (attempts, last attempt time)
    public static readonly ConcurrentDictionary<string, (int Attempts, DateTime LastAttempt)> PreAuthAttempts =
        new(StringComparer.OrdinalIgnoreCase);

    // Cooldown durations after each bad attempt (index = 0-based failed attempt count)
    private static readonly TimeSpan[] Cooldowns =
    {
        TimeSpan.Zero,          // after 1st fail: no cooldown
        TimeSpan.Zero,          // after 2nd fail: no cooldown
        TimeSpan.FromMinutes(3),  // after 3rd fail: 3 min
        TimeSpan.FromMinutes(8),  // after 4th fail: 8 min
        TimeSpan.FromMinutes(15), // after 5th fail: 15 min
    };

    public static TimeSpan GetCooldownFor(int failedAttempts)
    {
        if (failedAttempts <= 0) return TimeSpan.Zero;
        int idx = Math.Min(failedAttempts - 1, Cooldowns.Length - 1);
        return Cooldowns[idx];
    }

    public static bool IsBanned(string ip, out DateTime expiry)
    {
        if (IpBanExpiry.TryGetValue(ip, out expiry))
        {
            if (DateTime.UtcNow < expiry) return true;
            IpBanExpiry.TryRemove(ip, out _); // expired ban — clean up
        }
        expiry = default;
        return false;
    }

    public static bool IsInCooldown(string ip, out TimeSpan remaining)
    {
        if (PreAuthAttempts.TryGetValue(ip, out var state))
        {
            var cooldown = GetCooldownFor(state.Attempts);
            if (cooldown > TimeSpan.Zero)
            {
                var cooldownEnds = state.LastAttempt + cooldown;
                if (DateTime.UtcNow < cooldownEnds)
                {
                    remaining = cooldownEnds - DateTime.UtcNow;
                    return true;
                }
            }
        }
        remaining = TimeSpan.Zero;
        return false;
    }

    /// <summary>Load active DB bans into memory on startup (eager warm-up).</summary>
    public static async Task WarmUpFromDatabaseAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var activeBans = await db.AdminAccessBans
            .Where(b => b.IsActive && b.BanUntilUtc != null && b.BanUntilUtc > DateTimeOffset.UtcNow)
            .ToListAsync();

        foreach (var ban in activeBans)
            IpBanExpiry[ban.IpAddress] = ban.BanUntilUtc!.Value.UtcDateTime;

        Console.WriteLine($"[AdminBanRegistry] Loaded {activeBans.Count} active IP ban(s) from database.");
    }
}

public sealed class AdminIpWhitelistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor<AdminSettingsOptions> _options;
    private readonly IServiceProvider _services;
    private readonly ILogger<AdminIpWhitelistMiddleware> _logger;

    public AdminIpWhitelistMiddleware(
        RequestDelegate next,
        IOptionsMonitor<AdminSettingsOptions> options,
        IServiceProvider services,
        ILogger<AdminIpWhitelistMiddleware> logger)
    {
        _next = next;
        _options = options;
        _services = services;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                 ?? context.Connection.RemoteIpAddress?.ToString()
                 ?? "unknown";

        // ── STEP 1: IP Whitelist check ───────────────────────────────────
        var allowedIps = _options.CurrentValue.AllowedIps ?? new List<string>();
        if (!allowedIps.Contains(ip, StringComparer.OrdinalIgnoreCase))
        {
            _logger.LogWarning("[Security] Blocked admin access from non-whitelisted IP: {Ip}", ip);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Forbidden",
                message = "Admin Portal is restricted to authorized networks only."
            });
            return;
        }

        // ── STEP 2: Check 24-hour IP ban ─────────────────────────────────
        if (AdminBanRegistry.IsBanned(ip, out var banExpiry))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Locked",
                message = $"This IP is temporarily blocked due to multiple failed attempts. Try again after {banExpiry:u} UTC."
            });
            return;
        }

        // ── STEP 3: Cooldown check ────────────────────────────────────────
        if (AdminBanRegistry.IsInCooldown(ip, out var remaining))
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "TooManyRequests",
                message = $"Too many failed attempts. Please wait {(int)remaining.TotalSeconds} seconds before trying again."
            });
            return;
        }

        // ── STEP 4: Pre-Auth Secret Key check (skip for already-authed routes) ──
        // Routes that require valid JWT token (already have [Authorize]) don't
        // need the pre-auth key again after login; but the login endpoint itself
        // requires it to even see the login form.
        var path = context.Request.Path.Value ?? string.Empty;
        bool isPreAuthEndpoint = path.EndsWith("/preauth", StringComparison.OrdinalIgnoreCase);
        bool isLoginEndpoint   = path.EndsWith("/login",   StringComparison.OrdinalIgnoreCase);

        if (isPreAuthEndpoint || isLoginEndpoint)
        {
            var clientKey = context.Request.Headers["X-Admin-PreAuth-Key"].ToString();
            var expectedKey = _options.CurrentValue.SecretPreAuthKey ?? string.Empty;

            if (string.IsNullOrEmpty(clientKey) || clientKey != expectedKey)
            {
                _logger.LogWarning("[Security] Bad pre-auth key from IP: {Ip}", ip);
                await RecordFailedAttemptAsync(ip, context);
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Unauthorized",
                    message = "Invalid or missing pre-authentication key."
                });
                return;
            }

            // Good key — reset attempt counter for this IP
            AdminBanRegistry.PreAuthAttempts.TryRemove(ip, out _);
        }

        await _next(context);
    }

    private async Task RecordFailedAttemptAsync(string ip, HttpContext context)
    {
        var updated = AdminBanRegistry.PreAuthAttempts.AddOrUpdate(
            ip,
            _ => (1, DateTime.UtcNow),
            (_, old) => (old.Attempts + 1, DateTime.UtcNow));

        const int banThreshold = 5;
        if (updated.Attempts >= banThreshold)
        {
            var banUntil = DateTime.UtcNow.AddHours(24);
            AdminBanRegistry.IpBanExpiry[ip] = banUntil;
            AdminBanRegistry.PreAuthAttempts.TryRemove(ip, out _);
            _logger.LogWarning("[Security] IP {Ip} banned for 24 hours after {N} failed pre-auth attempts.", ip, banThreshold);

            // Fire-and-forget persistence to DB (write-behind pattern)
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _services.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var existing = await db.AdminAccessBans.FirstOrDefaultAsync(b => b.IpAddress == ip);
                    if (existing != null)
                    {
                        existing.BanUntilUtc = banUntil;
                        existing.FailedAttempts = banThreshold;
                        existing.LastAttemptAt = DateTimeOffset.UtcNow;
                        existing.IsActive = true;
                        existing.Reason = "5 failed pre-auth key attempts";
                    }
                    else
                    {
                        db.AdminAccessBans.Add(new GiftShop.Domain.Entities.AdminAccessBan
                        {
                            IpAddress = ip,
                            FailedAttempts = banThreshold,
                            LastAttemptAt = DateTimeOffset.UtcNow,
                            BanUntilUtc = banUntil,
                            IsActive = true,
                            Reason = "5 failed pre-auth key attempts"
                        });
                    }
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    // Log but never crash the pipeline
                    Console.Error.WriteLine($"[BanRegistry] DB write-behind failed for {ip}: {ex.Message}");
                }
            });
        }
    }
}