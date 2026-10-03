using System.ComponentModel.DataAnnotations;
using GiftShop.Api.Services;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize]
public class AdminDashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IDashboardActivityService _activityService;

    public AdminDashboardController(ApplicationDbContext db, IDashboardActivityService activityService)
    {
        _db = db;
        _activityService = activityService;
    }

    /// <summary>GET /api/admin/dashboard/activity?page=1&pageSize=50</summary>
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.SystemAuditLogs
            .AsNoTracking()
            .OrderByDescending(l => l.ActionDate)
            .Select(l => new
            {
                l.Id,
                l.ActionDate,
                l.RemoteIpAddress,
                l.ForwardedFor,
                l.UserAgent,
                l.Description,
                l.ActionType
            });

        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        // Log the fetch (after successful retrieval)
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var forwardedFor = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        var userAgent = HttpContext.Request.Headers["User-Agent"].FirstOrDefault();
        await _activityService.LogActivityAsync(ip, forwardedFor, userAgent, "Admin fetched activity logs", AuditActionType.DashboardActivity);

        return Ok(new { total, page, pageSize, items });
    }

    public record DeleteActivityRequest(
        [Required] string TotpCode,
        [Required] string ConfirmationText,
        List<Guid>? Ids
    );

    [HttpDelete("activity")]
    public async Task<IActionResult> DeleteActivity([FromBody] DeleteActivityRequest req)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // Ban/cooldown check before even validating TOTP
        var (isBanned, banExpiry) = _activityService.IsIpBanned(ip);
        if (isBanned)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Locked",
                message = $"IP banned until {banExpiry:u} UTC.",
                retryAfterSeconds = (int)(banExpiry!.Value - DateTime.UtcNow).TotalSeconds
            });
        }

        var cooldown = _activityService.GetCooldownRemaining(ip);
        if (cooldown > TimeSpan.Zero)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                error = "Cooldown",
                retryAfterSeconds = (int)cooldown.TotalSeconds,
                message = $"Wait {(int)cooldown.TotalSeconds}s before another deletion attempt."
            });
        }

        // Validate confirmation phrase
        const string expectedPhrase = "I confirm, that I as the admin, wants to delete the entries of the activities of the dashboard";
        if (!string.Equals(req.ConfirmationText?.Trim(), expectedPhrase, StringComparison.Ordinal))
        {
            return BadRequest(new { error = $"Confirmation phrase must be exactly: \"{expectedPhrase}\"" });
        }

        // Validate TOTP
        var (isValid, errorMsg) = await _activityService.VerifyTotpForDeletionAsync(req.TotpCode, ip);
        if (!isValid)
        {
            // If the TOTP was invalid and we are now banned/cooldown, return appropriate error
            if (errorMsg?.Contains("banned") == true)
            {
                var (_, newBanExpiry) = _activityService.IsIpBanned(ip);
                return StatusCode(StatusCodes.Status403Forbidden, new
                 { 
                    error = "Locked",
                    message = errorMsg,
                    retryAfterSeconds = newBanExpiry.HasValue ? (int)(newBanExpiry.Value - DateTime.UtcNow).TotalSeconds : 86400 
                });
            }
            if (errorMsg?.Contains("Wait") == true)
        {
            var newCooldown = _activityService.GetCooldownRemaining(ip);
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                error = "Cooldown",
                message = errorMsg,
                retryAfterSeconds = (int)newCooldown.TotalSeconds
            });
        }
            return BadRequest(new { error = errorMsg ?? "Invalid TOTP." });
        }

        // Delete logs
        // Perform deletion using in‑memory filter to avoid EF Core translation bug
        int deletedCount;
        if (req.Ids != null && req.Ids.Any())
        {
            var allLogs = await _db.SystemAuditLogs.ToListAsync();  // small table, acceptable, as otherwise NPgSQL error happen due to the use of contains.
            //var logsToDelete = await _db.SystemAuditLogs.Where(l => req.Ids.Contains(l.Id)).ToListAsync();
            /*
            Delete failure: EF Core 10.0.5 + Npgsql preview translated req.Ids.Contains(l.Id) into an ANY expression that the SqlNullabilityProcessor could not handle.
            Fix: Since the activity table is small, we load all records into memory and filter with List<Guid>.Contains(). This bypasses the problematic query translation.
            */
            var logsToDelete = allLogs.Where(l => req.Ids.Contains(l.Id)).ToList();
            _db.SystemAuditLogs.RemoveRange(logsToDelete);
            deletedCount = logsToDelete.Count;
        }
        else
        {
            // Delete all dashboard-related logs (all in SystemAuditLogs)
            var allLogs = await _db.SystemAuditLogs.ToListAsync();
            _db.SystemAuditLogs.RemoveRange(allLogs);
            deletedCount = allLogs.Count;
        }

        await _db.SaveChangesAsync();

        // Log the successful deletion (after the deletion so it survives)
        await _activityService.LogActivityAsync(ip, null, null, $"Admin deleted {deletedCount} activity log entries", AuditActionType.DashboardDeletionAttempt);

        return Ok(new { deleted = deletedCount });
    }

    [HttpGet("database-size")]
    public async Task<IActionResult> GetDatabaseSize()
    {
        var sql = @"
            SELECT pg_size_pretty(pg_database_size(current_database())) AS size;
        ";
        // Execute raw SQL
        await using var cmd = _db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = sql;
        await _db.Database.OpenConnectionAsync();
        var result = await cmd.ExecuteScalarAsync() as string;
        await _db.Database.CloseConnectionAsync();
        return Ok(new { size = result ?? "unknown" });
    }
}