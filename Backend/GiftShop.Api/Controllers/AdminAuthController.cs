using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GiftShop.Api.Services;
using GiftShop.Infrastructure.Options;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin")]
public sealed class AdminAuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IOptions<AdminSettingsOptions> _adminOpts;
    private readonly IOptions<JwtSettingsOptions> _jwtOpts;
    private readonly IAdminTotpService _totp;

    public AdminAuthController(
        ApplicationDbContext db,
        IOptions<AdminSettingsOptions> adminOpts,
        IOptions<JwtSettingsOptions> jwtOpts,
        IAdminTotpService totp)
    {
        _db        = db;
        _adminOpts = adminOpts;
        _jwtOpts   = jwtOpts;
        _totp      = totp;
    }

    // ── Stage 0: TOTP status (public — called before login to decide which stages to show) ──
    /// <summary>
    /// Returns whether the TOTP stage is currently enabled.
    /// Called by the Angular login component on first load so it can show 2 or 3 stages.
    /// This endpoint is intentionally public (no pre-auth key required).
    /// </summary>
    [HttpGet("totp-status")]
    public async Task<IActionResult> TotpStatus()
    {
        var enabled = await GetIsTotpEnabledAsync();
        return Ok(new { totpEnabled = enabled });
    }

    // ── Stage 1: Pre-auth secret key ────────────────────────────────────
    /// <summary>
    /// Validates the 16-char pre-auth secret key sent in X-Admin-PreAuth-Key header.
    /// Enforced by AdminIpWhitelistMiddleware — if we reach here, the key is valid.
    /// </summary>
    [HttpPost("preauth")]
    public IActionResult PreAuth()
    {
        return Ok(new { success = true, message = "Pre-auth key accepted. Proceed ahead ." });
    }

    // ── Stage 2: TOTP verification ───────────────────────────────────────
    /// <summary>
    /// Validates the 6-digit TOTP code from the admin's authenticator app.
    /// Must be called after /preauth and before /login.
    /// On success returns { gatewayPassed: true } — frontend may now show login form.
    /// Enforces 1-minute cooldowns and 24-hour IP ban after 3 consecutive failures.
    /// </summary>
    public sealed record TotpVerifyRequest(string Code);

    [HttpPost("verify-totp")]
    public async Task<IActionResult> VerifyTotp([FromBody] TotpVerifyRequest req)
    {
        // If TOTP is disabled, this endpoint is a no-op (the middleware still
        // passes through; the frontend simply never calls it).
        var isTotpEnabled = await GetIsTotpEnabledAsync();
        if (!isTotpEnabled)
            return Ok(new { gatewayPassed = true, message = "TOTP stage is disabled." });
        
        // Use the real connection IP — not X-Forwarded-For which can be spoofed.
        // (Behind a trusted reverse proxy you'd read the forwarded IP instead,
        //  but for a free-tier single-server deployment this is the safest option.)
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // 24-hour ban check (catches both pre-auth and TOTP ban entries)
        if (_totp.IsIpBanned(clientIp))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error   = "Locked",
                message = "This IP is banned for 24 hours due to repeated failed attempts."
            });
        }

        // Cooldown check — return seconds remaining so the frontend can countdown
        var cooldown = _totp.GetCooldownRemaining(clientIp);
        if (cooldown > TimeSpan.Zero)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                error              = "TooManyRequests",
                message            = $"Wrong code. Wait {(int)Math.Ceiling(cooldown.TotalSeconds)}s before trying again.",
                retryAfterSeconds  = (int)Math.Ceiling(cooldown.TotalSeconds)
            });
        }

        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "Code is required." });

        var (isValid, errorMessage) = await _totp.VerifyTotpAsync(req.Code, clientIp);

        if (!isValid)
        {
            // Artificial delay — blunts automated multi-threaded brute-force attempts
            await Task.Delay(600);
            return BadRequest(new { error = errorMessage ?? "Invalid authenticator code." });
        }

        return Ok(new { gatewayPassed = true, message = "TOTP verified. Proceed to login." });
    }

    // ── Stage 3: Username + password login ──────────────────────────────
    /// <summary>
    /// Issues a JWT for the admin.
    /// Requires X-Admin-PreAuth-Key header (middleware-enforced) AND a successful
    /// TOTP verification in the same session (enforced by the Angular frontend
    /// which only navigates here after /verify-totp returns gatewayPassed=true).
    /// </summary>
    public sealed record LoginRequest(string UserName, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        // Artificial delay to blunt brute-force even after passing prior gates
        await Task.Delay(400);

        var admin = await _db.AdminUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName == req.UserName && u.IsActive);

        if (admin == null || !BCrypt.Net.BCrypt.Verify(req.Password, admin.PasswordHash))
        {
            await Task.Delay(600); // extra delay on failure
            return Unauthorized(new { error = "Invalid credentials." });
        }

        var jwt   = _jwtOpts.Value;
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Name,           admin.UserName),
            new Claim(ClaimTypes.Role,           admin.Role),
        };

        var token = new JwtSecurityToken(
            issuer:             jwt.Issuer,
            audience:           jwt.Audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(jwt.ExpiryMinutes),
            signingCredentials: creds);

        // Update last login timestamp
        var adminEntity = await _db.AdminUsers.FindAsync(admin.Id);
        if (adminEntity != null)
        {
            adminEntity.LastLoginAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            token       = new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt   = DateTime.UtcNow.AddMinutes(jwt.ExpiryMinutes),
            displayName = admin.DisplayName ?? admin.UserName
        });
    }

    // ── Security: Toggle TOTP on/off (requires valid JWT + fresh TOTP code) ──
    /// <summary>
    /// Toggles IsTotpEnabled in AdminSettings.
    /// Security model:
    ///   1. Caller must be authenticated (valid JWT) — enforced by [Authorize].
    ///   2. Caller must supply the exact confirmation phrase that matches what
    ///      the UI displayed (e.g. "I, Admin wants to toggle it off").
    ///   3. Caller must supply a fresh valid TOTP code — even when turning TOTP
    ///      OFF, so an attacker with a stolen JWT cannot silently disable it.
    /// The new IsTotpEnabled value is persisted in appsettings.json on disk so
    /// it survives server restarts.
    /// </summary>
    public sealed record TotpToggleRequest(
        string ConfirmationPhrase,
        string TotpCode);
 
    [HttpPost("totp-toggle")]
    [Authorize]
    public async Task<IActionResult> ToggleTotp([FromBody] TotpToggleRequest req)
    {
        var currentlyEnabled = await GetIsTotpEnabledAsync();
        var targetState      = !currentlyEnabled;
 
        // ── 1. Confirmation phrase check ─────────────────────────────────
        var expectedPhrase = currentlyEnabled
            ? "I, Admin wants to toggle it off"
            : "I, Admin wants to toggle it on";
 
        if (!string.Equals(req.ConfirmationPhrase?.Trim(), expectedPhrase, StringComparison.Ordinal))
            return BadRequest(new
            {
                error = $"Confirmation phrase does not match. Expected exactly: \"{expectedPhrase}\""
            });
 
        // ── 2. Fresh TOTP code check ─────────────────────────────────────
        // Even when turning TOTP OFF the admin must prove they hold the authenticator,
        // so a stolen JWT alone cannot silently disable the security stage.
        var secret = _adminOpts.Value.TotpSecret;
        if (string.IsNullOrWhiteSpace(secret))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "TOTP secret is not configured on this server. Cannot toggle TOTP."
            });
 
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var (isValid, errorMsg) = await _totp.VerifyTotpAsync(req.TotpCode?.Trim() ?? "", clientIp);
        if (!isValid)
        {
            await Task.Delay(600);
            return BadRequest(new { error = errorMsg ?? "Invalid authenticator code." });
        }
 
        // ── 3. Persist the new value to db ─────────────────
        // We update the value by write operation in db so the setting survives restarts.
        // IOptionsMonitor automatically reloads it (no restart needed).
        try
        {
            var setting = await _db.AdminSettings.FirstOrDefaultAsync(s => s.Key == "IsTotpEnabled");
            if (setting == null)
            {
                _db.AdminSettings.Add(new GiftShop.Domain.Entities.AdminSetting
                {
                    Key = "IsTotpEnabled",
                    Value = targetState ? "true" : "false"
                });
            }
            else
            {
                setting.Value = targetState ? "true" : "false";
                setting.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                error   = "Failed to persist setting to db.",
                details = ex.Message
            });
        }
 
        return Ok(new
        {
            totpEnabled = targetState,
            message     = targetState
                ? "TOTP is now ENABLED. The authenticator stage will be required on next login."
                : "TOTP is now DISABLED. Login will require only the pre-auth access key and credentials."
        });
    }
 
    // ── Helper: patch a key in db ──────────────────────────
    private async Task<bool> GetIsTotpEnabledAsync()
    {
        var setting = await _db.AdminSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == "IsTotpEnabled");
        
        // Default to true if no record exists yet (first run)
        return setting == null || setting.Value != "false"; // "true" or missing = enabled
    }
}
