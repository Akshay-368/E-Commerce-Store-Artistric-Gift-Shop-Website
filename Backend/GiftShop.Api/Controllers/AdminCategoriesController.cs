using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

/// <summary>
/// CRUD management for product categories.
/// Also exposes a public GET /api/categories endpoint (no auth) so the
/// frontend can build a filter dropdown without requiring admin credentials.
/// </summary>
[ApiController]
[Route("api/admin/categories")]
[Authorize]
public sealed class AdminCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IProductCacheService _cache;

    public AdminCategoriesController(ApplicationDbContext db, IProductCacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    // ── GET /api/admin/categories ──────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var cats = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.IsActive,
                _db.Products.Count(p => p.CategoryId == c.Id)))
            .ToListAsync();
        return Ok(cats);
    }

    // ── POST /api/admin/categories ─────────────────────────────────────
    public sealed record CreateCategoryRequest(string Name, string? Description);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Category name is required." });

        var slug = Slugify(req.Name);
        if (await _db.Categories.AnyAsync(c => c.Slug == slug))
            return Conflict(new { error = $"A category with slug '{slug}' already exists." });

        var cat = new GiftShop.Domain.Entities.Category
        {
            Name = req.Name.Trim(),
            Slug = slug,
            Description = req.Description?.Trim(),
            IsActive = true
        };

        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { }, new CategoryDto(cat.Id, cat.Name, cat.Slug, cat.Description, cat.IsActive, 0));
    }

    // ── PUT /api/admin/categories/{id} ─────────────────────────────────
    public sealed record UpdateCategoryRequest(string Name, string? Description, bool IsActive);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryRequest req)
    {
        var cat = await _db.Categories.FindAsync(id);
        if (cat == null) return NotFound();

        cat.Name = req.Name.Trim();
        cat.Description = req.Description?.Trim();
        cat.IsActive = req.IsActive;
        cat.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync(); // category name shown in product cards
        var count = await _db.Products.CountAsync(p => p.CategoryId == id);
        return Ok(new CategoryDto(cat.Id, cat.Name, cat.Slug, cat.Description, cat.IsActive, count));
    }

    // ── DELETE /api/admin/categories/{id} ──────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cat = await _db.Categories.FindAsync(id);
        if (cat == null) return NotFound();

        // Products referencing this category will have CategoryId set to NULL (OnDelete.SetNull)
        _db.Categories.Remove(cat);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return NoContent();
    }

    private static string Slugify(string input)
        => System.Text.RegularExpressions.Regex
            .Replace(input.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-")
            .Trim('-');

    private sealed record CategoryDto(
        Guid Id, string Name, string Slug, string? Description, bool IsActive, int ProductCount);
}

/// <summary>
/// Public (no auth) category listing — used by the storefront for filter UIs.
/// </summary>
[ApiController]
[Route("api/categories")]
public sealed class PublicCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PublicCategoriesController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var cats = await _db.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Slug })
            .ToListAsync();
        return Ok(cats);
    }
}