using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/admin/orders")]
[Authorize]
public sealed class AdminOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPdfInvoiceService _pdf;

    public AdminOrdersController(ApplicationDbContext db, IPdfInvoiceService pdf)
    {
        _db = db;
        _pdf = pdf;
    }

    // ── GET /api/admin/orders ──────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] OrderStatus? status = null)
    {
        var query = _db.Orders.AsNoTracking().AsQueryable();

        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        var total = await query.CountAsync();
        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListDto(
                o.Id,
                o.PublicOrderNumber,
                o.CustomerName,
                o.CustomerPhone,
                o.Status,
                o.PaymentStatus,
                o.TotalAmount,
                o.CreatedAt,
                o.Items.Count))
            .ToListAsync();

        return Ok(new { total, page, pageSize, items = orders });
    }

    // ── GET /api/admin/orders/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        return Ok(MapDetail(order));
    }

    // ── PUT /api/admin/orders/{id}/status ──────────────────────────────
    public sealed record UpdateStatusRequest(OrderStatus Status);

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest req)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        if (!IsValidTransition(order.Status, req.Status))
            return BadRequest(new { error = $"Cannot move from {order.Status} to {req.Status}." });

        order.Status = req.Status;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        if (req.Status == OrderStatus.Delivered)
            order.DeliveredAt = DateTimeOffset.UtcNow;
        else if (req.Status == OrderStatus.Cancelled)
            order.PaymentStatus = PaymentStatus.Refunded;

        await _db.SaveChangesAsync();
        return Ok(new { order.Id, order.Status, order.PaymentStatus });
    }

    // ── PUT /api/admin/orders/{id}/payment ─────────────────────────────
    public sealed record UpdatePaymentRequest(PaymentStatus PaymentStatus, string? TransactionId);

    [HttpPut("{id:guid}/payment")]
    public async Task<IActionResult> UpdatePayment(Guid id, [FromBody] UpdatePaymentRequest req)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        if (req.PaymentStatus == PaymentStatus.Verified)
        {
            order.PaymentStatus = PaymentStatus.Verified;
            order.TransactionId = req.TransactionId;
            order.PaidAt = DateTimeOffset.UtcNow;
            if (order.Status == OrderStatus.PendingPayment)
                order.Status = OrderStatus.PaymentVerified;
        }
        else if (req.PaymentStatus == PaymentStatus.Failed)
        {
            order.PaymentStatus = PaymentStatus.Failed;
            order.TransactionId = req.TransactionId;
        }
        else
        {
            return BadRequest(new { error = "Only Verified or Failed status is allowed via this endpoint." });
        }

        order.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { order.Id, order.PaymentStatus, order.Status, order.TransactionId });
    }

    // ── POST /api/admin/orders/{id}/messages ───────────────────────────
    public sealed record AddMessageRequest(string MessageText);

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddMessageRequest req)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        var message = new OrderMessage
        {
            OrderId = id,
            Sender = "Admin",
            MessageText = req.MessageText.Trim(),
        };

        _db.OrderMessages.Add(message);
        await _db.SaveChangesAsync();

        return Ok(new MessageDto(message.Id, message.Sender, message.MessageText, message.CreatedAt));
    }

    // ── GET /api/admin/orders/{id}/invoice ─────────────────────────────
    [HttpGet("{id:guid}/invoice")]
    public async Task<IActionResult> DownloadInvoice(Guid id)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        var pdfBytes = _pdf.GenerateInvoice(order);

        return File(pdfBytes, "application/pdf", $"invoice-{order.PublicOrderNumber}.pdf");
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private static bool IsValidTransition(OrderStatus current, OrderStatus next)
    {
        return (current, next) switch
        {
            (OrderStatus.PendingPayment, OrderStatus.PaymentVerified) => true,
            (OrderStatus.PendingPayment, OrderStatus.Cancelled) => true,

            (OrderStatus.PaymentVerified, OrderStatus.Packed) => true,
            (OrderStatus.PaymentVerified, OrderStatus.Cancelled) => true,

            (OrderStatus.Packed, OrderStatus.Dispatched) => true,
            (OrderStatus.Packed, OrderStatus.Cancelled) => true,

            (OrderStatus.Dispatched, OrderStatus.Delivered) => true,
            (OrderStatus.Dispatched, OrderStatus.Cancelled) => false, // can't cancel after dispatch normally

            _ => false
        };
    }

    private static object MapDetail(Order order) => new
    {
        order.Id,
        order.PublicOrderNumber,
        order.CustomerName,
        order.CustomerPhone,
        order.CustomerAddress,
        order.Status,
        order.PaymentStatus,
        order.Subtotal,
        order.ShippingFee,
        order.TotalAmount,
        order.TransactionId,
        order.CreatedAt,
        order.PaidAt,
        order.DeliveredAt,
        Items = order.Items.Select(i => new
        {
            i.Id,
            i.ProductId,
            i.TitleSnapshot,
            i.PriceSnapshot,
            i.Quantity
        }),
        Messages = order.Messages.Select(m => new MessageDto(
            m.Id, m.Sender, m.MessageText, m.CreatedAt))
    };

    // ── DTOs ──────────────────────────────────────────────────────────
    private sealed record OrderListDto(
        Guid Id,
        string PublicOrderNumber,
        string CustomerName,
        string CustomerPhone,
        OrderStatus Status,
        PaymentStatus PaymentStatus,
        decimal TotalAmount,
        DateTimeOffset CreatedAt,
        int ItemCount);

    private sealed record MessageDto(
        Guid Id,
        string Sender,
        string MessageText,
        DateTimeOffset CreatedAt);
}