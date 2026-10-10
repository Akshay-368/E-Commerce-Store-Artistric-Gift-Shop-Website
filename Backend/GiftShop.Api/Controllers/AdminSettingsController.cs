using GiftShop.Infrastructure.Persistence;
using GiftShop.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize(Roles = "SuperAdmin")]
public class AdminSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AdminSettingsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _db.AdminSettings.ToListAsync();
        var dict = settings.ToDictionary(s => s.Key, s => s.Value);
        return Ok(dict);
    }

    public sealed record UpsertSettingsRequest(Dictionary<string, string> Settings);

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertSettingsRequest req)
    {
        if (req.Settings == null)
            return BadRequest(new { message = "Settings cannot be null" });

        var existing = await _db.AdminSettings.ToListAsync();
        foreach (var kvp in req.Settings)
        {
            var entity = existing.FirstOrDefault(s => s.Key == kvp.Key);
            if (entity != null)
            {
                entity.Value = kvp.Value;
            }
            else
            {
                _db.AdminSettings.Add(new AdminSetting
                {
                    Key = kvp.Key,
                    Value = kvp.Value
                });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Settings updated successfully" });
    }
}
