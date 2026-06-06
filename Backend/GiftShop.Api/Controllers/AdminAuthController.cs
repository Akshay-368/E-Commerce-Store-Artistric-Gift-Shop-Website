using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
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

    public AdminAuthController(
        ApplicationDbContext db,
        IOptions<AdminSettingsOptions> adminOpts,
        IOptions<JwtSettingsOptions> jwtOpts)
    {
        _db = db;
        _adminOpts = adminOpts;
        _jwtOpts = jwtOpts;
    }

    /// <summary>
    /// Validates the 16-char pre-auth secret key. Must be called before /login.
    /// Requires X-Admin-PreAuth-Key header (enforced by middleware).
    /// </summary>
    [HttpPost("preauth")]
    public IActionResult PreAuth()
    {
        // Middleware already validated the key — if we reach here, it's valid.
        return Ok(new { success = true, message = "Pre-auth key accepted. Proceed to login." });
    }

    public sealed record LoginRequest(string UserName, string Password);

    /// <summary>
    /// Issues a JWT for the admin. Requires X-Admin-PreAuth-Key header (middleware-enforced).
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        // Artificial delay to blunt brute-force even after passing rate limiting
        await Task.Delay(400);

        var admin = await _db.AdminUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName == req.UserName && u.IsActive);

        if (admin == null || !BCrypt.Net.BCrypt.Verify(req.Password, admin.PasswordHash))
        {
            await Task.Delay(600); // extra delay on failure
            return Unauthorized(new { error = "Invalid credentials." });
        }

        var jwt = _jwtOpts.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Name, admin.UserName),
            new Claim(ClaimTypes.Role, admin.Role),
        };

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(jwt.ExpiryMinutes),
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
            token = new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt = DateTime.UtcNow.AddMinutes(jwt.ExpiryMinutes),
            displayName = admin.DisplayName ?? admin.UserName
        });
    }
}