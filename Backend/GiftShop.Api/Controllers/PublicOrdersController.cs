using System.Text.RegularExpressions;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;   // ← added for IPdfInvoiceService
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class PublicOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPdfInvoiceService _pdf;   // ← new field

    // Updated constructor – accepts both dependencies
    public PublicOrdersController(ApplicationDbContext db, IPdfInvoiceService pdf)
    {
        _db = db;
        _pdf = pdf;
    }

    // ── POST /api/orders ──────────────────────────────────────────────
    public sealed record CreateOrderRequest(
        string CustomerName,
        string CustomerPhone,
        string CustomerAddress,
        List<CreateOrderItem> Items,
        PaymentMethod PaymentMethod,
        string? TransactionId = null
    );

    public sealed record CreateOrderItem(Guid ProductId, int Quantity);

    // Fixed phone regex: exactly 10 digits
    private static readonly Regex PhoneRegex = new Regex(@"^\d{10}$");

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.CustomerName) ||
            string.IsNullOrWhiteSpace(req.CustomerPhone) ||
            string.IsNullOrWhiteSpace(req.CustomerAddress))
            return BadRequest(new { error = "Customer name, phone, and address are required." });

        // Phone validation – exactly 10 digits
        if (!PhoneRegex.IsMatch(req.CustomerPhone.Trim()))
            return BadRequest(new { error = "Phone number must be exactly 10 digits (no country code or symbols)." });

        if (req.Items == null || req.Items.Count == 0)
            return BadRequest(new { error = "Order must contain at least one item." });
        
        // Only UPI or Online allowed
        if (req.PaymentMethod != PaymentMethod.UPI && req.PaymentMethod != PaymentMethod.Online)
            return BadRequest(new { error = "Payment method must be UPI or Online." });
        if (req.PaymentMethod == PaymentMethod.UPI && string.IsNullOrWhiteSpace(req.TransactionId))
            return BadRequest(new { error = "Transaction ID is required for UPI payments." });

        // Fetch products (workaround for Npgsql bug)
        var productIds = req.Items.Select(i => i.ProductId).Distinct().ToList();
        var allActiveProducts = await _db.Products
            .Where(p => p.IsActive)
            .ToListAsync();

        var products = allActiveProducts
            .Where(p => productIds.Contains(p.Id))
            .ToDictionary(p => p.Id);

        if (products.Count != productIds.Count)
            return BadRequest(new { error = "One or more products are invalid or unavailable." });

        decimal subtotal = 0;
        var orderItems = new List<OrderItem>();

        foreach (var item in req.Items)
        {
            var product = products[item.ProductId];
            decimal price = product.Price;
            decimal lineTotal = price * item.Quantity;
            subtotal += lineTotal;

            orderItems.Add(new OrderItem
            {
                ProductId = product.Id,
                TitleSnapshot = product.Title,
                PriceSnapshot = price,
                Quantity = item.Quantity
            });
        }

        decimal shippingFee = subtotal >= 1000 ? 0 : 100;
        decimal totalAmount = subtotal + shippingFee;

        var order = new Order
        {
            PublicOrderNumber = GenerateOrderNumber(),
            CustomerName = req.CustomerName.Trim(),
            CustomerPhone = req.CustomerPhone.Trim(),
            CustomerAddress = req.CustomerAddress.Trim(),
            Status = OrderStatus.PendingPayment,
            PaymentStatus = PaymentStatus.Pending,
            Subtotal = subtotal,
            ShippingFee = shippingFee,
            TotalAmount = totalAmount,
            Items = orderItems,
            Messages = new List<OrderMessage>
            {
                new OrderMessage
                {
                    Sender = "System",
                    MessageText = "Order placed. Please complete payment and share the transaction ID."
                }
            }
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            order.PublicOrderNumber,
            order.TotalAmount,
            order.Status,
            order.CustomerName,
            order.CustomerPhone,
            order.CustomerAddress
        });
    }

    // ── GET /api/orders/{publicOrderNumber} ───────────────────────────
    [HttpGet("{publicOrderNumber}")]
    public async Task<IActionResult> GetByNumber(string publicOrderNumber)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(o => o.PublicOrderNumber == publicOrderNumber);

        if (order == null) return NotFound();

        return Ok(new
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
            Messages = order.Messages.Select(m => new
            {
                m.Id,
                m.Sender,
                m.MessageText,
                m.CreatedAt
            })
        });
    }

    // ── GET /api/orders/{publicOrderNumber}/invoice ────────────────────
    [HttpGet("{publicOrderNumber}/invoice")]
    public async Task<IActionResult> DownloadInvoice(string publicOrderNumber)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.PublicOrderNumber == publicOrderNumber);

        if (order == null) return NotFound();

        var pdfBytes = _pdf.GenerateInvoice(order);
        return File(pdfBytes, "application/pdf", $"invoice-{order.PublicOrderNumber}.pdf");
    }

    // ── POST /api/orders/{publicOrderNumber}/messages ─────────────────
    public sealed record AddMessageRequest(string MessageText);

    [HttpPost("{publicOrderNumber}/messages")]
    public async Task<IActionResult> AddMessage(string publicOrderNumber,
        [FromBody] AddMessageRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.MessageText))
            return BadRequest(new { error = "Message text is required." });

        var order = await _db.Orders
            .FirstOrDefaultAsync(o => o.PublicOrderNumber == publicOrderNumber);
        if (order == null) return NotFound();

        var msg = new OrderMessage
        {
            OrderId = order.Id,
            Sender = "Customer",
            MessageText = req.MessageText.Trim()
        };

        _db.OrderMessages.Add(msg);
        await _db.SaveChangesAsync();

        return Ok(new { msg.Id, msg.Sender, msg.MessageText, msg.CreatedAt });
    }

    // ── GET /api/orders/by-phone/{phone} ───────────────────────────────
    [HttpGet("by-phone/{phone}")]
    public async Task<IActionResult> GetByPhone(string phone)
    {
        var orders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Messages.OrderBy(m => m.CreatedAt))
            .Where(o => o.CustomerPhone == phone)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        if (orders.Count == 0) return NotFound();

        var result = orders.Select(order => new
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
            Messages = order.Messages.Select(m => new
            {
                m.Id,
                m.Sender,
                m.MessageText,
                m.CreatedAt
            })
        });

        return Ok(result);
    }

    private static string GenerateOrderNumber()
        => $"ORD-{DateTime.UtcNow.Year}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
}