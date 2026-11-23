using GiftShop.Domain.Entities;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/payment-details")]
[Authorize]
public sealed class AdminPaymentDetailsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AdminPaymentDetailsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var details = await _db.PaymentDetails
            .AsNoTracking()
            .OrderBy(d => d.SortOrder)
            .Select(d => new PaymentDetailDto(d.Id, d.Key, d.Value, d.SortOrder, d.IsActive))
            .ToListAsync();
        return Ok(details);
    }

    public sealed record CreatePaymentDetailRequest(string Key, string Value, int SortOrder = 0);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePaymentDetailRequest req)
    {
        var detail = new PaymentDetail
        {
            Key = req.Key.Trim(),
            Value = req.Value.Trim(),
            SortOrder = req.SortOrder,
            IsActive = true
        };
        _db.PaymentDetails.Add(detail);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new PaymentDetailDto(detail.Id, detail.Key, detail.Value, detail.SortOrder, detail.IsActive));
    }

    public sealed record UpdatePaymentDetailRequest(string Key, string Value, int SortOrder, bool IsActive);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePaymentDetailRequest req)
    {
        var detail = await _db.PaymentDetails.FindAsync(id);
        if (detail == null) return NotFound();
        detail.Key = req.Key.Trim();
        detail.Value = req.Value.Trim();
        detail.SortOrder = req.SortOrder;
        detail.IsActive = req.IsActive;
        detail.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new PaymentDetailDto(detail.Id, detail.Key, detail.Value, detail.SortOrder, detail.IsActive));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var detail = await _db.PaymentDetails.FindAsync(id);
        if (detail == null) return NotFound();
        _db.PaymentDetails.Remove(detail);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var detail = await _db.PaymentDetails.FindAsync(id);
        if (detail == null) return NotFound();
        detail.IsActive = !detail.IsActive;
        detail.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { detail.Id, detail.IsActive });
    }

    private sealed record PaymentDetailDto(Guid Id, string Key, string Value, int SortOrder, bool IsActive);
}