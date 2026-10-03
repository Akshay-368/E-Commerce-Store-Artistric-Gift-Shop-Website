using System.Collections.Concurrent;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Api.Middleware;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Services;

public interface IDashboardActivityService
{
    Task LogActivityAsync(string? ip, string? forwardedFor, string? userAgent, string description, AuditActionType actionType);
    (bool IsBanned, DateTime? BanExpiry) IsIpBanned(string ip);
    TimeSpan GetCooldownRemaining(string ip);
    Task<(bool IsValid, string? ErrorMessage)> VerifyTotpForDeletionAsync(string code, string ip);
}

public class DashboardActivityService : IDashboardActivityService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<DashboardActivityService> _logger;

    // Dashboard‑specific TOTP attempt tracker (separate from login TOTP)
    private static readonly ConcurrentDictionary<string, (int Attempts, DateTime CooldownUntil)>
        TotpAttempts = new(StringComparer.OrdinalIgnoreCase);

    private const int BanThreshold = 3;
    private static readonly TimeSpan BaseCooldown = TimeSpan.FromMinutes(2);

    public DashboardActivityService(IServiceProvider services, ILogger<DashboardActivityService> logger)
    {
        _services = services;
        _logger = logger;
    }

    public async Task LogActivityAsync(string? ip, string? forwardedFor, string? userAgent, string description, AuditActionType actionType)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SystemAuditLogs.Add(new SystemAuditLog
            {
                RemoteIpAddress = ip,
                ForwardedFor = forwardedFor,
                UserAgent = userAgent,
                Description = description,
                ActionType = actionType,
                ActionDate = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write dashboard activity log");
        }
    }

    public (bool IsBanned, DateTime? BanExpiry) IsIpBanned(string ip)
    {
        if (AdminBanRegistry.IsBanned(ip, out var expiry))
            return (true, expiry);
        return (false, null);
    }

    public TimeSpan GetCooldownRemaining(string ip)
    {
        if (TotpAttempts.TryGetValue(ip, out var state))
        {
            var remaining = state.CooldownUntil - DateTime.UtcNow;
            return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
        }
        return TimeSpan.Zero;
    }

    public async Task<(bool IsValid, string? ErrorMessage)> VerifyTotpForDeletionAsync(string code, string ip)
    {
        // Ban check
        if (AdminBanRegistry.IsBanned(ip, out var banExpiry))
        {
            return (false, $"IP banned until {banExpiry:u} UTC.");
        }

        // Cooldown check
        var cooldown = GetCooldownRemaining(ip);
        if (cooldown > TimeSpan.Zero)
        {
            return (false, $"Cooldown active. Wait {(int)cooldown.TotalSeconds}s.");
        }

        // Validate TOTP using the same secret as login TOTP (but separate attempt counter)
        var adminSettings = _services.GetRequiredService<Microsoft.Extensions.Options.IOptions<Infrastructure.Options.AdminSettingsOptions>>().Value;
        var secret = adminSettings.TotpSecret;
        if (string.IsNullOrWhiteSpace(secret))
        {
            _logger.LogError("TOTP secret not configured");
            return (false, "Server configuration error.");
        }

        bool isValid;
        try
        {
            var secretBytes = OtpNet.Base32Encoding.ToBytes(secret.Trim().ToUpperInvariant());
            var totp = new OtpNet.Totp(secretBytes, step: 30, mode: OtpNet.OtpHashMode.Sha1, totpSize: 6);
            var window = new OtpNet.VerificationWindow(1, 1);
            isValid = totp.VerifyTotp(code.Trim(), out _, window);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TOTP validation error");
            return (false, "TOTP validation error.");
        }

        if (!isValid)
        {
            await HandleFailedAttemptAsync(ip);
            // Log invalid attempt
            await LogActivityAsync(ip, null, null, "Invalid TOTP attempt for dashboard deletion", AuditActionType.DashboardInvalidTotp);
            return (false, "Invalid TOTP code.");
        }

        // Success: clear attempts for this IP
        TotpAttempts.TryRemove(ip, out _);
        return (true, null);
    }

    private async Task HandleFailedAttemptAsync(string ip)
    {
        var updated = TotpAttempts.AddOrUpdate(
            ip,
            _ => (1, DateTime.UtcNow + BaseCooldown),
            (_, old) =>
            {
                var newAttempts = old.Attempts + 1;
                // Exponential cooldown: 2^ (attempts-1) * base (2 min)
                var cooldownDuration = TimeSpan.FromMinutes(Math.Pow(2, newAttempts - 1) * 2);
                var newCooldownUntil = DateTime.UtcNow + cooldownDuration;
                return (newAttempts, newCooldownUntil);
            });

        if (updated.Attempts >= BanThreshold)
        {
            var banUntil = DateTime.UtcNow.AddHours(24);
            AdminBanRegistry.IpBanExpiry[ip] = banUntil;
            TotpAttempts.TryRemove(ip, out _);
            _logger.LogWarning("IP {Ip} banned for 24h after {N} wrong dashboard TOTP attempts", ip, BanThreshold);

            // Fire-and-forget DB persistence
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
                        existing.FailedAttempts = BanThreshold;
                        existing.LastAttemptAt = DateTimeOffset.UtcNow;
                        existing.IsActive = true;
                        existing.Reason = $"{BanThreshold} wrong dashboard TOTP codes";
                    }
                    else
                    {
                        db.AdminAccessBans.Add(new AdminAccessBan
                        {
                            IpAddress = ip,
                            FailedAttempts = BanThreshold,
                            LastAttemptAt = DateTimeOffset.UtcNow,
                            BanUntilUtc = banUntil,
                            IsActive = true,
                            Reason = $"{BanThreshold} wrong dashboard TOTP codes"
                        });
                    }
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[DashboardActivityService] DB write-behind failed: {ex.Message}");
                }
            });
        }
    }
}