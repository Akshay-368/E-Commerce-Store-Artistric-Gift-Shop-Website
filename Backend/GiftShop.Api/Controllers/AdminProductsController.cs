using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/products")]
[Authorize]
public sealed class AdminProductsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IProductCacheService _cache;
    private readonly ICloudinaryService _cloudinary;

    public AdminProductsController(
        ApplicationDbContext db,
        IProductCacheService cache,
        ICloudinaryService cloudinary)
    {
        _db = db;
        _cache = cache;
        _cloudinary = cloudinary;
    }

    // ── GET /api/admin/products ─────────────────────────────────────────
    [HttpGet]
    public IActionResult GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var all = _cache.GetAll();
        var paged = all.Skip((page - 1) * pageSize).Take(pageSize);
        return Ok(new { total = all.Count, page, pageSize, items = paged });
    }

    // ── GET /api/admin/products/{id} ────────────────────────────────────
    [HttpGet("{id:guid}")]
    public IActionResult GetById(Guid id)
    {
        var product = _cache.GetById(id);
        if (product == null) return NotFound();
        return Ok(product);
    }

    // ── POST /api/admin/products ─────────────────────────────────────────
    public sealed record CreateProductRequest(
        string Title,
        string Description,
        decimal Price,
        // CategoryId is explicitly optional — if omitted or null, product is "Uncategorized"
        Guid? CategoryId,
        string? ShortDescription,
        int SortOrder = 0
    );

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = "Product title is required." });
        if (string.IsNullOrWhiteSpace(req.Description))
            return BadRequest(new { error = "Product description is required." });
        if (req.Price < 0)
            return BadRequest(new { error = "Price cannot be negative." });

        // Validate CategoryId only if one was actually provided
        Guid? resolvedCategoryId = null;
        if (req.CategoryId.HasValue && req.CategoryId.Value != Guid.Empty)
        {
            var categoryExists = await _db.Categories
                .AnyAsync(c => c.Id == req.CategoryId.Value && c.IsActive);
            if (!categoryExists)
                return BadRequest(new { error = $"Category '{req.CategoryId}' does not exist or is inactive." });
            resolvedCategoryId = req.CategoryId.Value;
        }

        var slug = Slugify(req.Title);
        var existing = await _db.Products.CountAsync(p => p.Slug == slug);
        if (existing > 0) slug = $"{slug}-{existing}";

        var product = new GiftShop.Domain.Entities.Product
        {
            Title = req.Title.Trim(),
            Slug = slug,
            Description = req.Description.Trim(),
            ShortDescription = req.ShortDescription?.Trim(),
            Price = req.Price,
            CategoryId = resolvedCategoryId,   // NULL is fine now
            SortOrder = req.SortOrder,
            IsActive = true
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, _cache.GetById(product.Id));
    }

    // ── PUT /api/admin/products/{id} ────────────────────────────────────
    public sealed record UpdateProductRequest(
        string Title,
        string Description,
        decimal Price,
        Guid? CategoryId,
        string? ShortDescription,
        bool IsActive,
        int SortOrder
    );

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest req)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();

        // Validate CategoryId if provided
        Guid? resolvedCategoryId = product.CategoryId; // keep existing by default
        if (req.CategoryId.HasValue)
        {
            if (req.CategoryId.Value == Guid.Empty)
            {
                resolvedCategoryId = null; // explicitly cleared
            }
            else
            {
                var categoryExists = await _db.Categories
                    .AnyAsync(c => c.Id == req.CategoryId.Value && c.IsActive);
                if (!categoryExists)
                    return BadRequest(new { error = $"Category '{req.CategoryId}' does not exist or is inactive." });
                resolvedCategoryId = req.CategoryId.Value;
            }
        }

        product.Title = req.Title.Trim();
        product.Description = req.Description.Trim();
        product.ShortDescription = req.ShortDescription?.Trim();
        product.Price = req.Price;
        product.CategoryId = resolvedCategoryId;
        product.IsActive = req.IsActive;
        product.SortOrder = req.SortOrder;
        product.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return Ok(_cache.GetById(id));
    }

    // ── DELETE /api/admin/products/{id} ──────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product == null) return NotFound();

        foreach (var img in product.Images.Where(i => !string.IsNullOrEmpty(i.PublicId)))
        {
            try { await _cloudinary.DeleteImageAsync(img.PublicId!); }
            catch { /* log but continue */ }
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return NoContent();
    }

    // ── POST /api/admin/products/{id}/images ─────────────────────────────
    [HttpPost("{id:guid}/images")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file, [FromQuery] bool isPrimary = false)
    {
        var product = await _db.Products.Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound();

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        if (file.Length > 8 * 1024 * 1024)
            return BadRequest(new { error = "File exceeds the 8 MB maximum." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, and GIF images are allowed." });

        await using var stream = file.OpenReadStream();
        var (url, publicId) = await _cloudinary.UploadProductImageAsync(stream, file.FileName);

        if (isPrimary)
        {
            foreach (var existingImg in product.Images.Where(i => i.IsPrimary))
                existingImg.IsPrimary = false;
        }

        var nextSortOrder = product.Images.Any() ? product.Images.Max(i => i.SortOrder) + 1 : 0;

        var image = new GiftShop.Domain.Entities.ProductImage
        {
            ProductId = id,
            ImageUrl = url,
            PublicId = publicId,
            AltText = file.FileName,
            IsPrimary = isPrimary || !product.Images.Any(),
            SortOrder = nextSortOrder
        };

        _db.ProductImages.Add(image);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();

        return Ok(new ProductImageDto(
            image.Id,
            image.ImageUrl,
            image.PublicId,
            image.AltText,
            image.IsPrimary,
            image.SortOrder
        ));
    }

    // ── DELETE /api/admin/products/{id}/images/{imageId} ──────────────────
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
    {
        var image = await _db.ProductImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == id);
        if (image == null) return NotFound();

        if (!string.IsNullOrEmpty(image.PublicId))
        {
            try { await _cloudinary.DeleteImageAsync(image.PublicId); }
            catch { /* non-fatal */ }
        }

        _db.ProductImages.Remove(image);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return NoContent();
    }

    // ── PUT /api/admin/products/{id}/images/{imageId}/primary ─────────────
    [HttpPut("{id:guid}/images/{imageId:guid}/primary")]
    public async Task<IActionResult> SetPrimaryImage(Guid id, Guid imageId)
    {
        var images = await _db.ProductImages.Where(i => i.ProductId == id).ToListAsync();
        if (!images.Any(i => i.Id == imageId)) return NotFound();
        foreach (var img in images) img.IsPrimary = img.Id == imageId;
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return Ok();
    }

    // ── Private helpers ──────────────────────────────────────────────────
    private static string Slugify(string input)
        => System.Text.RegularExpressions.Regex
            .Replace(input.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-")
            .Trim('-');

    private sealed record ProductImageDto(
        Guid Id, string ImageUrl, string? PublicId, string? AltText, bool IsPrimary, int SortOrder)
    {
        public string OptimizedUrl => ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/");
    }
}