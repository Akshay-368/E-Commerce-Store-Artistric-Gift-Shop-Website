using GiftShop.Api.Middleware;
using GiftShop.Infrastructure.Options;
using Microsoft.Extensions.Options;
using OtpNet;
using Microsoft.EntityFrameworkCore;
namespace GiftShop.Api.Services;

/// <summary>
/// Validates 6-digit TOTP codes (RFC 6238, SHA-1, 30-second step).
/// Enforces per-IP cooldowns and 24-hour bans through the shared
/// AdminBanRegistry — the same registry used by the pre-auth middleware,
/// so a ban from either stage blocks both gates.
/// </summary>
public interface IAdminTotpService
{
    /// <summary>Returns true if the IP is currently serving a 24-hour ban.</summary>
    bool IsIpBanned(string ipAddress);

    /// <summary>
    /// Validates <paramref name="code"/> against the configured TOTP secret.
    /// On failure: increments the TOTP-specific attempt counter, enforces a
    /// 1-minute cooldown, and bans the IP after 3 consecutive wrong codes.
    /// On success: clears the attempt counter for this IP.
    /// </summary>
    Task<(bool IsValid, string? ErrorMessage)> VerifyTotpAsync(string code, string clientIp);

    /// <summary>Returns remaining cooldown for the IP, or zero if none.</summary>
    TimeSpan GetCooldownRemaining(string clientIp);
}

public sealed class AdminTotpService : IAdminTotpService
{
    // Separate namespace from the pre-auth attempt keys so the counters
    // are tracked independently (TOTP failures don't burn pre-auth slots).
    private const string TOTP_ATTEMPT_PREFIX = "TotpAttempts_";
    private const string TOTP_COOLDOWN_PREFIX = "TotpCooldown_";

    // How long the admin must wait after each wrong TOTP code
    private static readonly TimeSpan CooldownDuration = TimeSpan.FromMinutes(1);

    // Number of consecutive wrong codes before the IP is banned for 24 hours
    private const int BanThreshold = 3;

    // IMemoryCache-backed attempt & cooldown state (keyed by IP)
    // Stored directly on AdminBanRegistry's ConcurrentDictionaries to avoid
    // a second IMemoryCache dependency; reuses the same warm-up mechanism.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (int Attempts, DateTime CooldownUntil)>
        TotpAttempts = new(StringComparer.OrdinalIgnoreCase);

    private readonly IOptionsMonitor<AdminSettingsOptions> _opts;
    private readonly ILogger<AdminTotpService> _logger;
    private readonly IServiceProvider _services;

    public AdminTotpService(
        IOptionsMonitor<AdminSettingsOptions> opts,
        ILogger<AdminTotpService> logger,
        IServiceProvider services)
    {
        _opts = opts;
        _logger = logger;
        _services = services;
    }

    public bool IsIpBanned(string ipAddress)
        => AdminBanRegistry.IsBanned(ipAddress, out _);

    public TimeSpan GetCooldownRemaining(string clientIp)
    {
        if (TotpAttempts.TryGetValue(clientIp, out var state))
        {
            var remaining = state.CooldownUntil - DateTime.UtcNow;
            if (remaining > TimeSpan.Zero) return remaining;
        }
        return TimeSpan.Zero;
    }

    public async Task<(bool IsValid, string? ErrorMessage)> VerifyTotpAsync(string code, string clientIp)
    {
        // ── 1. Ban check ────────────────────────────────────────────────
        if (AdminBanRegistry.IsBanned(clientIp, out var banExpiry))
        {
            return (false, $"This IP is banned until {banExpiry:u} UTC due to repeated failed attempts.");
        }

        // ── 2. Cooldown check ───────────────────────────────────────────
        var cooldownRemaining = GetCooldownRemaining(clientIp);
        if (cooldownRemaining > TimeSpan.Zero)
        {
            var secs = (int)Math.Ceiling(cooldownRemaining.TotalSeconds);
            return (false, $"Too many wrong codes. Wait {secs} second(s) before trying again.");
        }

        // ── 3. Secret availability check ────────────────────────────────
        var secret = _opts.CurrentValue.TotpSecret;
        if (string.IsNullOrWhiteSpace(secret))
        {
            _logger.LogError("[TOTP] TotpSecret is not configured in AdminSettings. " +
                             "Set AdminSettings__TotpSecret environment variable.");
            return (false, "Server configuration error — TOTP not set up.");
        }

        // ── 4. Cryptographic validation ─────────────────────────────────
        bool isValid;
        try
        {
            var secretBytes = Base32Encoding.ToBytes(secret.Trim().ToUpperInvariant());
            var totp = new Totp(secretBytes, step: 30, mode: OtpHashMode.Sha1, totpSize: 6);

            // Window of 1 step → accepts current, previous, and next 30-second windows.
            // Gives a 90-second total cushion for clock drift and network lag.
            //var window = new VerificationWindow(previousDelaySteps: 1, futureDelaySteps: 1);
            var window = new VerificationWindow(1, 1);
            isValid = totp.VerifyTotp(code.Trim(), out _, window);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TOTP] Validation threw an exception for IP {Ip}. " +
                                 "Check that TotpSecret is a valid Base32 string.", clientIp);
            return (false, "Server configuration error — invalid TOTP secret format.");
        }

        if (!isValid)
        {
            await HandleFailedAttemptAsync(clientIp);
            _logger.LogWarning("[TOTP] Wrong code from IP {Ip}.", clientIp);
            return (false, "Invalid authenticator code.");
        }

        // ── 5. Success — clear slate for this IP ────────────────────────
        TotpAttempts.TryRemove(clientIp, out _);
        _logger.LogInformation("[TOTP] Code accepted for IP {Ip}.", clientIp);
        return (true, null);
    }

    // ── Private helpers ─────────────────────────────────────────────────

    private async Task HandleFailedAttemptAsync(string ip)
    {
        var updated = TotpAttempts.AddOrUpdate(
            ip,
            _ => (1, DateTime.UtcNow + CooldownDuration),
            (_, old) =>
            {
                // Only extend cooldown if not currently inside one (prevents
                // resetting the clock every time while still locked).
                var newCooldownUntil = old.CooldownUntil < DateTime.UtcNow
                    ? DateTime.UtcNow + CooldownDuration
                    : old.CooldownUntil;
                return (old.Attempts + 1, newCooldownUntil);
            });

        if (updated.Attempts >= BanThreshold)
        {
            var banUntil = DateTime.UtcNow.AddHours(24);
            AdminBanRegistry.IpBanExpiry[ip] = banUntil;
            TotpAttempts.TryRemove(ip, out _);

            _logger.LogWarning(
                "[TOTP] IP {Ip} banned for 24h after {N} consecutive wrong TOTP codes.",
                ip, BanThreshold);

            // Write-behind to DB (fire-and-forget — same pattern as pre-auth bans)
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _services.CreateScope();
                    var db = scope.ServiceProvider
                        .GetRequiredService<GiftShop.Infrastructure.Persistence.ApplicationDbContext>();

                    var existing = await db.AdminAccessBans
                        .FirstOrDefaultAsync(b => b.IpAddress == ip);

                    if (existing != null)
                    {
                        existing.BanUntilUtc    = banUntil;
                        existing.FailedAttempts = BanThreshold;
                        existing.LastAttemptAt  = DateTimeOffset.UtcNow;
                        existing.IsActive       = true;
                        existing.Reason         = $"{BanThreshold} consecutive wrong TOTP codes";
                    }
                    else
                    {
                        db.AdminAccessBans.Add(new GiftShop.Domain.Entities.AdminAccessBan
                        {
                            IpAddress      = ip,
                            FailedAttempts = BanThreshold,
                            LastAttemptAt  = DateTimeOffset.UtcNow,
                            BanUntilUtc    = banUntil,
                            IsActive       = true,
                            Reason         = $"{BanThreshold} consecutive wrong TOTP codes"
                        });
                    }
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(
                        $"[AdminTotpService] DB write-behind failed for {ip}: {ex.Message}");
                }
            });
        }
    }
}