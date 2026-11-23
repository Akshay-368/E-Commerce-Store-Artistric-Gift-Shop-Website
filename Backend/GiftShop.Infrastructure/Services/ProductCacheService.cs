using GiftShop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace GiftShop.Infrastructure.Services;

public sealed class ProductDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public decimal Price { get; set; }
    public string? CategoryName { get; set; }
    public Guid? CategoryId { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public List<ProductImageDto> Images { get; set; } = new();
}

public sealed class ProductImageDto
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? PublicId { get; set; }
    public string? AltText { get; set; }
    public bool IsPrimary { get; set; }
    public int SortOrder { get; set; }

    /// <summary>
    /// Returns the Cloudinary-optimized URL with f_auto,q_auto injected.
    /// Angular can also do this client-side — belt-and-suspenders approach.
    /// </summary>
    public string OptimizedUrl => ImageUrl.Replace("/upload/", "/upload/f_auto,q_auto/");
}

public interface IProductCacheService
{
    Task RefreshCacheAsync();
    IReadOnlyList<ProductDto> GetAll();
    IEnumerable<ProductDto> GetPaged(int page, int pageSize);
    int GetTotalCount();
    IEnumerable<ProductDto> Search(string query, string? categoryName = null);
    ProductDto? GetById(Guid id);
}

public sealed class ProductCacheService : IProductCacheService
{
    private readonly IServiceProvider _services;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ProductCacheService> _logger;
    private const string CacheKey = "GiftShop_AllProducts_v1";

    public ProductCacheService(IServiceProvider services, IMemoryCache cache, ILogger<ProductCacheService> logger)
    {
        _services = services;
        _cache = cache;
        _logger = logger;
    }

    public async Task RefreshCacheAsync()
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var products = await db.Products
            .AsNoTracking()
            .Where(p => p.IsActive)
            .Include(p => p.Images)
            .Include(p => p.Category)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Title)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                Title = p.Title,
                Description = p.Description,
                ShortDescription = p.ShortDescription,
                Price = p.Price,
                CategoryId = p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder,
                Images = p.Images
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ProductImageDto
                    {
                        Id = i.Id,
                        ImageUrl = i.ImageUrl,
                        PublicId = i.PublicId,
                        AltText = i.AltText,
                        IsPrimary = i.IsPrimary,
                        SortOrder = i.SortOrder
                    }).ToList()
            })
            .ToListAsync();

        _cache.Set(CacheKey, products, TimeSpan.FromDays(1));
        _logger.LogInformation("[ProductCache] Refreshed — {Count} active products loaded into RAM.", products.Count);
    }

    private List<ProductDto> All() => _cache.Get<List<ProductDto>>(CacheKey) ?? new List<ProductDto>();

    public IReadOnlyList<ProductDto> GetAll() => All();

    public IEnumerable<ProductDto> GetPaged(int page, int pageSize)
        => All().Skip((page - 1) * pageSize).Take(pageSize);

    public int GetTotalCount() => All().Count;

    public IEnumerable<ProductDto> Search(string query, string? categoryName = null)
    {
        var all = All().AsEnumerable();

        if (!string.IsNullOrWhiteSpace(categoryName))
            all = all.Where(p => string.Equals(p.CategoryName, categoryName, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.ToLowerInvariant();
            all = all.Where(p =>
                p.Title.ToLower().Contains(q) ||
                p.Description.ToLower().Contains(q) ||
                (p.ShortDescription?.ToLower().Contains(q) ?? false) ||
                (p.CategoryName?.ToLower().Contains(q) ?? false));
        }

        return all;
    }

    public ProductDto? GetById(Guid id) => All().FirstOrDefault(p => p.Id == id);
}