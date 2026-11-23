using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class PublicProductsController : ControllerBase
{
    private readonly IProductCacheService _cache;

    public PublicProductsController(IProductCacheService cache) => _cache = cache;

    /// <summary>
    /// Returns ALL products at once for client-side memory search/pagination (Option B from blueprint).
    /// Since the catalog is small, the client loads everything into memory on boot and filters locally.
    /// </summary>
    [HttpGet]
    public IActionResult GetAll()
    {
        var products = _cache.GetAll()
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Description,
                p.ShortDescription,
                p.Price,
                p.CategoryName,
                p.SortOrder,
                Images = p.Images.Select(i => new
                {
                    i.Id,
                    i.ImageUrl,
                    i.OptimizedUrl, // f_auto,q_auto injected server-side as well
                    i.AltText,
                    i.IsPrimary,
                    i.SortOrder
                })
            });

        return Ok(products);
    }

    /// <summary>
    /// Paged endpoint for future use / progressive enhancement.
    /// </summary>
    [HttpGet("paged")]
    public IActionResult GetPaged([FromQuery] int page = 1, [FromQuery] int pageSize = 8)
    {
        var paged = _cache.GetPaged(page, pageSize);
        return Ok(new { total = _cache.GetTotalCount(), page, pageSize, items = paged });
    }

    [HttpGet("{id:guid}")]
    public IActionResult GetById(Guid id)
    {
        var product = _cache.GetById(id);
        if (product == null) return NotFound();
        return Ok(product);
    }
}