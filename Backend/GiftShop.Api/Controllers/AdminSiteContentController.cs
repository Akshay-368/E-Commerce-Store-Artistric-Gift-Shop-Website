using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

/// <summary>
/// Manages site content items — section images stored as binary (bytea) in PostgreSQL,
/// and text content like headings and copy. Used by all non-product sections (hero,
/// manifesto, feature-1, feature-2, highlights, etc.).
/// 
/// Multiple images per section are stored with the same SectionName but different SortOrder.
/// The frontend slideshows through them automatically.
/// Image priority: BinaryValue (admin-uploaded) > ExternalImageUrl (seeded default / CDN).
/// </summary>
[ApiController]
[Route("api/admin/content")]
[Authorize]
public sealed class AdminSiteContentController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AdminSiteContentController(ApplicationDbContext db) => _db = db;

    // ── GET /api/admin/content ──────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.SiteContentItems
            .AsNoTracking()
            .OrderBy(i => i.SectionName).ThenBy(i => i.SortOrder)
            .Select(i => new SiteContentSummaryDto(
                i.Id, i.ContentKey, i.SectionName, i.Kind.ToString(),
                i.TextValue, i.MimeType, i.DisplayLocation, i.AltText,
                i.SortOrder, i.IsActive, i.BinaryValue != null , i.ExternalImageUrl))
            .ToListAsync();
        return Ok(items);
    }

    private sealed record SiteContentSummaryDto(
        Guid Id, string ContentKey, string SectionName, string Kind,
        string? TextValue, string? MimeType, string? DisplayLocation,
        string? AltText, int SortOrder, bool IsActive, bool HasBinary ,string? ExternalImageUrl);

    // ── GET /api/content (public: returns text items + image URLs, NOT binary) ─
    [HttpGet("/api/content")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublic()
    {
        var items = await _db.SiteContentItems
            .AsNoTracking()
            .Where(i => i.IsActive)
            .OrderBy(i => i.SectionName).ThenBy(i => i.SortOrder)
            .Select(i => new
            {
                i.Id,
                i.ContentKey,
                i.SectionName,
                Kind = i.Kind.ToString(),
                i.TextValue,
                i.MimeType,
                i.DisplayLocation,
                i.AltText,
                i.SortOrder,
                // Binary uploaded images get served via /api/content/{id}/image.
                // Exrernal-URL images (seeded defaults) are served directly.
                // The frontend checks imageUrl firts and resolves the right source.
                // Provide image URL endpoint — binary served separately
                ImageUrl = i.Kind == SiteContentItemKind.Image ? (i.BinaryValue != null ? $"/api/content/{i.Id}/image" : i.ExternalImageUrl) : null
            })
            .ToListAsync();
        return Ok(items);
    }

    // ── GET /api/content/{id}/image (streams binary image to browser) ───
    [HttpGet("/api/content/{id:guid}/image")]
    [AllowAnonymous]
    public async Task<IActionResult> GetImage(Guid id)
    {
        var item = await _db.SiteContentItems
            .AsNoTracking()
            .Where(i => i.Id == id && i.Kind == SiteContentItemKind.Image && i.IsActive)
            .Select(i => new { i.BinaryValue, i.MimeType , i.ExternalImageUrl})
            .FirstOrDefaultAsync();
        
        if (item == null) return NotFound();

        // It binary was uploaded by admin, serve it directly
        if (item.BinaryValue != null) 
        {
            Response.Headers["Cache-Control"] = "public, max-age=86400"; // 24h browser cache
            return File(item.BinaryValue ,item.MimeType ?? "image/jpeg");
            //return NotFound();
        }

        // Otherwise redirect to the external url (unslpash / cloudinary default)
        if (!string.IsNullOrEmpty(item.ExternalImageUrl)) return Redirect(item.ExternalImageUrl);
        return NotFound();

        /* var mime = item.MimeType ?? "image/jpeg";
        Response.Headers["Cache-Control"] = "public, max-age=86400"; 
        return File(item.BinaryValue, mime); */
    }

    // ── POST /api/admin/content/image ────────────────────────────────────
    [HttpPost("image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(
        IFormFile file,
        [FromQuery] string section,
        [FromQuery] string contentKey,
        [FromQuery] string? altText,
        [FromQuery] string? displayLocation,
        [FromQuery] int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(section) || string.IsNullOrWhiteSpace(contentKey))
            return BadRequest(new { error = "section and contentKey are required." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, and GIF images are allowed." });

        if (file.Length > 8 * 1024 * 1024)
            return BadRequest(new { error = "File exceeds 8 MB." });

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms);

        // If a seeded item with this contentKey exists, update it instead of creating a duplicate
        var existing = await _db.SiteContentItems.FirstOrDefaultAsync(i => i.ContentKey == contentKey);
        if (existing != null)
        {
            existing.BinaryValue = ms.ToArray();
            existing.MimeType = file.ContentType;
            existing.AltText = altText ?? existing.AltText;
            existing.IsActive = true;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            var item = new SiteContentItem
            {
                ContentKey = contentKey,
                SectionName = section,
                Kind = SiteContentItemKind.Image,
                BinaryValue = ms.ToArray(),
                MimeType = file.ContentType,
                AltText = altText,
                DisplayLocation = displayLocation,
                SortOrder = sortOrder,
                IsActive = true
            };
            _db.SiteContentItems.Add(item);
        }

        await _db.SaveChangesAsync();
        var saved = await _db.SiteContentItems.FirstAsync(i => i.ContentKey == contentKey);

        return Ok(new
        {
            saved.Id, saved.ContentKey, saved.SectionName, saved.AltText, saved.SortOrder,
            ImageUrl = $"/api/content/{saved.Id}/image"
        });
    }

    // ── PUT /api/admin/content/text ──────────────────────────────────────
    public sealed record UpsertTextRequest(
        string ContentKey, string SectionName, string TextValue,
        string? DisplayLocation, int SortOrder = 0);

    [HttpPut("text")]
    public async Task<IActionResult> UpsertText([FromBody] UpsertTextRequest req)
    {
        var existing = await _db.SiteContentItems
            .FirstOrDefaultAsync(i => i.ContentKey == req.ContentKey);

        if (existing != null)
        {
            existing.TextValue = req.TextValue;
            existing.SortOrder = req.SortOrder;
            existing.DisplayLocation = req.DisplayLocation;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            _db.SiteContentItems.Add(new SiteContentItem
            {
                ContentKey = req.ContentKey,
                SectionName = req.SectionName,
                Kind = SiteContentItemKind.Text,
                TextValue = req.TextValue,
                DisplayLocation = req.DisplayLocation,
                SortOrder = req.SortOrder,
                IsActive = true
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    // ── DELETE /api/admin/content/{id} ────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var item = await _db.SiteContentItems.FindAsync(id);
        if (item == null) return NotFound();
        _db.SiteContentItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── PUT /api/admin/content/{id}/toggle ────────────────────────────────
    [HttpPut("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var item = await _db.SiteContentItems.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        item.UpdatedAt= DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { item.Id, item.IsActive });
    }
}