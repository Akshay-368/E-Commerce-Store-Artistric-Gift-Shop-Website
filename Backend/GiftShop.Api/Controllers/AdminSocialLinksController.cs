using GiftShop.Domain.Entities;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/social-links")]
[Authorize]
public sealed class AdminSocialLinksController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AdminSocialLinksController(ApplicationDbContext db) => _db = db;

    // GET all
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var links = await _db.SocialLinks
            .AsNoTracking()
            .OrderBy(l => l.SortOrder)
            .Select(l => new SocialLinkDto(l.Id, l.Icon, l.Name, l.Url, l.SortOrder, l.IsActive))
            .ToListAsync();
        return Ok(links);
    }

    // POST create
    public sealed record CreateSocialLinkRequest(string Icon, string Name, string Url, int SortOrder = 0);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSocialLinkRequest req)
    {
        var link = new SocialLink
        {
            Icon = req.Icon?.Trim() ?? "📎",
            Name = req.Name.Trim(),
            Url = req.Url.Trim(),
            SortOrder = req.SortOrder,
            IsActive = true
        };
        _db.SocialLinks.Add(link);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new SocialLinkDto(link.Id, link.Icon, link.Name, link.Url, link.SortOrder, link.IsActive));
    }

    // PUT update
    public sealed record UpdateSocialLinkRequest(string Icon, string Name, string Url, int SortOrder, bool IsActive);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSocialLinkRequest req)
    {
        var link = await _db.SocialLinks.FindAsync(id);
        if (link == null) return NotFound();
        link.Icon = req.Icon.Trim();
        link.Name = req.Name.Trim();
        link.Url = req.Url.Trim();
        link.SortOrder = req.SortOrder;
        link.IsActive = req.IsActive;
        link.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new SocialLinkDto(link.Id, link.Icon, link.Name, link.Url, link.SortOrder, link.IsActive));
    }

    // DELETE
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var link = await _db.SocialLinks.FindAsync(id);
        if (link == null) return NotFound();
        _db.SocialLinks.Remove(link);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Toggle active
    [HttpPut("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var link = await _db.SocialLinks.FindAsync(id);
        if (link == null) return NotFound();
        link.IsActive = !link.IsActive;
        link.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { link.Id, link.IsActive });
    }

    private sealed record SocialLinkDto(Guid Id, string Icon, string Name, string Url, int SortOrder, bool IsActive);
}