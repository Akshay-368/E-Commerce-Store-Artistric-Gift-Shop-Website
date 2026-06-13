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

    // ── Stage 1: Pre-auth secret key ────────────────────────────────────
    /// <summary>
    /// Validates the 16-char pre-auth secret key sent in X-Admin-PreAuth-Key header.
    /// Enforced by AdminIpWhitelistMiddleware — if we reach here, the key is valid.
    /// </summary>
    [HttpPost("preauth")]
    public IActionResult PreAuth()
    {
        return Ok(new { success = true, message = "Pre-auth key accepted. Proceed to TOTP verification." });
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
}