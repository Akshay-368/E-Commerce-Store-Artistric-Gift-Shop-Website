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
    // Admin sees ALL products (active AND inactive) — directly from DB, not cache.
    // The public /api/products endpoint uses cache (active-only).
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        var query = _db.Products
            .AsNoTracking()
            .Include(p => p.Images)
            .Include(p => p.Category)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Title);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id, p.Title, p.Description, p.ShortDescription,
                p.Price, p.IsActive, p.SortOrder,
                VideoUrl = p.VideoUrl,
                CategoryId = p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                Images = p.Images.OrderBy(i => i.SortOrder).Select(i => new
                {
                    i.Id, i.ImageUrl,
                    OptimizedUrl = i.ImageUrl.Contains("/upload/")
                        ? i.ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/")
                        : i.ImageUrl,
                    i.AltText, i.IsPrimary, i.SortOrder
                })
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }

    // ── GET /api/admin/products/{id} ────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Images)
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound();
        return Ok(new
        {
            product.Id, product.Title, product.Description, product.ShortDescription,
            product.Price, product.IsActive, product.SortOrder,
            VideoUrl = product.VideoUrl,
            CategoryId = product.CategoryId,
            CategoryName = product.Category?.Name,
            Images = product.Images.OrderBy(i => i.SortOrder).Select(i => new
            {
                i.Id, i.ImageUrl,
                OptimizedUrl = i.ImageUrl.Contains("/upload/")
                    ? i.ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/")
                    : i.ImageUrl,
                i.AltText, i.IsPrimary, i.SortOrder
            })
        });
    }

    // ── POST /api/admin/products ─────────────────────────────────────────
    public sealed record CreateProductRequest(
        string Title, string Description, decimal Price,
        Guid? CategoryId, string? ShortDescription, int SortOrder = 0);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = "Product title is required." });
        if (string.IsNullOrWhiteSpace(req.Description))
            return BadRequest(new { error = "Product description is required." });
        if (req.Price < 0)
            return BadRequest(new { error = "Price cannot be negative." });

        Guid? resolvedCategoryId = null;
        if (req.CategoryId.HasValue && req.CategoryId.Value != Guid.Empty)
        {
            var catExists = await _db.Categories.AnyAsync(c => c.Id == req.CategoryId.Value && c.IsActive);
            if (!catExists) return BadRequest(new { error = "Category not found or inactive." });
            resolvedCategoryId = req.CategoryId.Value;
        }

        var slug = Slugify(req.Title);
        var existing = await _db.Products.CountAsync(p => p.Slug == slug);
        if (existing > 0) slug = $"{slug}-{existing}";

        var product = new GiftShop.Domain.Entities.Product
        {
            Title = req.Title.Trim(), Slug = slug,
            Description = req.Description.Trim(),
            ShortDescription = req.ShortDescription?.Trim(),
            Price = req.Price, CategoryId = resolvedCategoryId,
            SortOrder = req.SortOrder, IsActive = true
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, await GetProductDto(product.Id));
    }

    // ── PUT /api/admin/products/{id} ────────────────────────────────────
    public sealed record UpdateProductRequest(
        string Title, string Description, decimal Price,
        Guid? CategoryId, string? ShortDescription, bool IsActive, int SortOrder);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest req)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();

        Guid? resolvedCategoryId = product.CategoryId;
        if (req.CategoryId.HasValue)
        {
            if (req.CategoryId.Value == Guid.Empty)
                resolvedCategoryId = null;
            else
            {
                var catExists = await _db.Categories.AnyAsync(c => c.Id == req.CategoryId.Value && c.IsActive);
                if (!catExists) return BadRequest(new { error = "Category not found or inactive." });
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
        return Ok(await GetProductDto(id));
    }

    // ── DELETE /api/admin/products/{id} ──────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var product = await _db.Products.Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound();

        foreach (var img in product.Images.Where(i => !string.IsNullOrEmpty(i.PublicId)))
        {
            try { await _cloudinary.DeleteImageAsync(img.PublicId!); }
            catch { /* log, continue */ }
        }

        // Delete video if present
        if (!string.IsNullOrEmpty(product.VideoPublicId))
        {
            try { await _cloudinary.DeleteVideoAsync(product.VideoPublicId); }
            catch { /* log, continue */ }
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

        if (file == null || file.Length == 0) return BadRequest(new { error = "No file uploaded." });
        if (file.Length > 8 * 1024 * 1024) return BadRequest(new { error = "File exceeds 8 MB maximum." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, and GIF images are allowed." });

        await using var stream = file.OpenReadStream();
        var (url, publicId) = await _cloudinary.UploadProductImageAsync(stream, file.FileName);

        if (isPrimary)
            foreach (var e in product.Images.Where(i => i.IsPrimary)) e.IsPrimary = false;

        var nextSort = product.Images.Any() ? product.Images.Max(i => i.SortOrder) + 1 : 0;
        var image = new GiftShop.Domain.Entities.ProductImage
        {
            ProductId = id, ImageUrl = url, PublicId = publicId,
            AltText = file.FileName, IsPrimary = isPrimary || !product.Images.Any(),
            SortOrder = nextSort
        };

        _db.ProductImages.Add(image);
        await _db.SaveChangesAsync();
        await _cache.RefreshCacheAsync();

        return Ok(new ProductImageDto(image.Id, image.ImageUrl,
            image.ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/"),
            image.PublicId, image.AltText, image.IsPrimary, image.SortOrder));
    }

    // ── DELETE /api/admin/products/{id}/images/{imageId} ──────────────────
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
    {
        var image = await _db.ProductImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == id);
        if (image == null) return NotFound();

        if (!string.IsNullOrEmpty(image.PublicId))
            try { await _cloudinary.DeleteImageAsync(image.PublicId); } catch { /* non-fatal */ }

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

    // ── Helpers ──────────────────────────────────────────────────────────
    private static string Slugify(string input)
        => System.Text.RegularExpressions.Regex
            .Replace(input.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-").Trim('-');

    private async Task<object> GetProductDto(Guid id)
    {
        var p = await _db.Products.AsNoTracking()
            .Include(x => x.Images).Include(x => x.Category)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return new { };
        return new
        {
            p.Id, p.Title, p.Description, p.ShortDescription,
            p.Price, p.IsActive, p.SortOrder,
            CategoryId = p.CategoryId,
            VideoUrl = p.VideoUrl,
            CategoryName = p.Category?.Name,
            Images = p.Images.OrderBy(i => i.SortOrder).Select(i => new
            {
                i.Id, i.ImageUrl,
                OptimizedUrl = i.ImageUrl.Contains("/upload/")
                    ? i.ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/")
                    : i.ImageUrl,
                i.AltText, i.IsPrimary, i.SortOrder
            })
        };
    }

    // ── POST /api/admin/products/{id}/video ─────────────────────────────
[HttpPost("{id:guid}/video")]
[RequestSizeLimit(9 * 1024 * 1024)]
public async Task<IActionResult> UploadVideo(Guid id, IFormFile file)
{
    var product = await _db.Products.FindAsync(id);
    if (product == null) return NotFound();

    if (file == null || file.Length == 0) return BadRequest(new { error = "No file uploaded." });
    if (file.Length > 8 * 1024 * 1024) return BadRequest(new { error = "File exceeds 8 MB maximum." });

    var allowedTypes = new[] { "video/mp4", "video/webm", "video/ogg", "video/quicktime" };
    if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
        return BadRequest(new { error = "Only MP4, WebM, OGG, and MOV videos are allowed." });

    // Delete old video if present
    if (!string.IsNullOrEmpty(product.VideoPublicId))
    {
        try { await _cloudinary.DeleteVideoAsync(product.VideoPublicId); } catch { /* log, continue */ }
    }

    await using var stream = file.OpenReadStream();
    var (url, publicId) = await _cloudinary.UploadVideoAsync(stream, file.FileName, "products");

    product.VideoUrl = url;
    product.VideoPublicId = publicId;
    product.UpdatedAt = DateTimeOffset.UtcNow;
    await _db.SaveChangesAsync();
    await _cache.RefreshCacheAsync();

    return Ok(new { videoUrl = url });
}

// ── DELETE /api/admin/products/{id}/video ─────────────────────────────
[HttpDelete("{id:guid}/video")]
public async Task<IActionResult> DeleteVideo(Guid id)
{
    var product = await _db.Products.FindAsync(id);
    if (product == null) return NotFound();

    if (!string.IsNullOrEmpty(product.VideoPublicId))
    {
        try { await _cloudinary.DeleteVideoAsync(product.VideoPublicId); } catch { /* non-fatal */ }
    }

    product.VideoUrl = null;
    product.VideoPublicId = null;
    product.UpdatedAt = DateTimeOffset.UtcNow;
    await _db.SaveChangesAsync();
    await _cache.RefreshCacheAsync();
    return NoContent();
}



    private sealed record ProductImageDto(
        Guid Id, string ImageUrl, string OptimizedUrl,
        string? PublicId, string? AltText, bool IsPrimary, int SortOrder);
}