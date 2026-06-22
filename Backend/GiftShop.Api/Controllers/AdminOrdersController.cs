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


    // ── DELETE /api/admin/orders (bulk, single, or all-completed) ─────────────
    /// <summary>
    /// Deletes one or more orders. Only orders with status Delivered OR payment
    /// status Failed are eligible — active/in-flight orders cannot be deleted.
    ///
    /// Request body:
    ///   ids      – array of order GUIDs to delete (required, 1–200 items)
    ///
    /// Cascade behaviour (all handled by EF Core / DB):
    ///   OrderItems   → Cascade delete  (frees the Product FK restriction so
    ///                                   the product can then be deleted/re-used)
    ///   OrderMessages → Cascade delete
    ///   Reviews       → Cascade delete
    ///
    /// Returns a summary: how many were deleted and how many were skipped
    /// (because they were not in a deletable state).
    /// </summary>
    public sealed record BulkDeleteOrdersRequest(List<Guid> Ids);

[HttpDelete]
public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteOrdersRequest req)
{
    if (req.Ids == null || req.Ids.Count == 0)
        return BadRequest(new { error = "At least one order ID is required." });

    if (req.Ids.Count > 200)
        return BadRequest(new { error = "Cannot delete more than 200 orders at once." });

    // We avoid any .Contains in EF queries because of Npgsql preview bugs.
    // Instead we fetch each order individually (max 200, perfectly fine).

    var deletableIds = new List<Guid>();
    var skippedNumbers = new List<string>();

    foreach (var id in req.Ids)
    {
        // Minimal query – only get what we need for eligibility check
        var info = await _db.Orders
            .Where(o => o.Id == id)
            .Select(o => new { o.Id, o.PublicOrderNumber, o.Status, o.PaymentStatus })
            .FirstOrDefaultAsync();

        if (info == null)
        {
            skippedNumbers.Add($"unknown-{id.ToString().Substring(0, 8)}");
            continue;
        }

        if (info.Status == OrderStatus.Delivered || info.PaymentStatus == PaymentStatus.Failed || info.Status == OrderStatus.Cancelled)
        {
            deletableIds.Add(info.Id);
        }
        else
        {
            skippedNumbers.Add(info.PublicOrderNumber);
        }
    }

    if (deletableIds.Count == 0)
    {
        return BadRequest(new
        {
            error = "None of the selected orders are eligible for deletion.",
            skipped = skippedNumbers,
            message = "Only orders with status Delivered, Cancelled, or payment status Failed can be deleted."
        });
    }

    // Load the full entities for deletion (cascade will handle OrderItems, Messages, Reviews)
    var ordersToDelete = new List<Order>();
    foreach (var id in deletableIds)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order != null)
        {
            ordersToDelete.Add(order);
        }
    }

    _db.Orders.RemoveRange(ordersToDelete);
    await _db.SaveChangesAsync();

    return Ok(new
    {
        deleted = ordersToDelete.Count,
        skipped = skippedNumbers,
        message = skippedNumbers.Count > 0
            ? $"Deleted {ordersToDelete.Count} order(s). Skipped {skippedNumbers.Count} order(s) that were not in a deletable state."
            : $"Successfully deleted {ordersToDelete.Count} order(s)."
    });
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