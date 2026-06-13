using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

/// <summary>
/// Provides public endpoints for social links and payment details.
/// </summary>
[ApiController]
[Route("api")]
public sealed class PublicSiteContentController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public PublicSiteContentController(ApplicationDbContext db) => _db = db;

    [HttpGet("social-links")]
    public async Task<IActionResult> GetSocialLinks()
    {
        var links = await _db.SocialLinks
            .AsNoTracking()
            .Where(l => l.IsActive)
            .OrderBy(l => l.SortOrder)
            .Select(l => new { l.Icon, l.Name, l.Url })
            .ToListAsync();
        return Ok(links);
    }

    [HttpGet("payment-details")]
    public async Task<IActionResult> GetPaymentDetails()
    {
        var details = await _db.PaymentDetails
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.SortOrder)
            .Select(d => new { d.Key, d.Value })
            .ToListAsync();
        return Ok(details);
    }
}