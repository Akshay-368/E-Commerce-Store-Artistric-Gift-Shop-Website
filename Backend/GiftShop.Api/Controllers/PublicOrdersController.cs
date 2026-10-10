using System.Text.RegularExpressions;
using GiftShop.Application.Abstractions;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace GiftShop.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class PublicOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPdfInvoiceService _pdf;
    private readonly IEmailService _emailService;
    private readonly ILogger<PublicOrdersController> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IShiprocketService _shiprocketService;

    public PublicOrdersController(
        ApplicationDbContext db,
        IPdfInvoiceService pdf,
        IEmailService emailService,
        ILogger<PublicOrdersController> logger,
        IServiceScopeFactory scopeFactory,
        IShiprocketService shiprocketService)
    {
        _db = db;
        _pdf = pdf;
        _emailService = emailService;
        _logger = logger;
        _scopeFactory = scopeFactory;
        _shiprocketService = shiprocketService;
    }

    // ── POST /api/orders ──────────────────────────────────────────────
    public sealed record CreateOrderRequest(
        string CustomerName,
        string CustomerEmail,
        string CustomerPhone,
        string CustomerAddress,
        string City,
        string State,
        string Pincode,
        List<CreateOrderItem> Items,
        PaymentMethod PaymentMethod,
        string? TransactionId = null
    );

    public sealed record CreateOrderItem(Guid ProductId, int Quantity);

    public sealed record EstimateOrderRequest(List<CreateOrderItem> Items, string? Pincode);

    // Fixed phone regex: exactly 10 digits
    private static readonly Regex PhoneRegex = new Regex(@"^\d{10}$");
    private static readonly Regex PincodeRegex = new Regex(@"^\d{6}$");

    [HttpPost("estimate")]
    public async Task<IActionResult> Estimate([FromBody] EstimateOrderRequest req)
    {
        if (req.Items == null || req.Items.Count == 0)
            return BadRequest(new { error = "Order must contain at least one item." });

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
        foreach (var item in req.Items)
        {
            var product = products[item.ProductId];
            subtotal += product.Price * item.Quantity;
        }

        var settings = await _db.AdminSettings.ToDictionaryAsync(s => s.Key, s => s.Value);
        var strategy = settings.GetValueOrDefault("ShippingStrategy", "Free");
        var flatRateStr = settings.GetValueOrDefault("FlatShippingRate", "0");
        if (!decimal.TryParse(flatRateStr, out decimal flatRate)) flatRate = 0m;

        decimal shippingFee = 0;
        if (strategy == "Free")
        {
            shippingFee = 0;
        }
        else if (strategy == "FlatRate")
        {
            shippingFee = flatRate;
        }
        else if (strategy == "Dynamic")
        {
            if (string.IsNullOrWhiteSpace(req.Pincode) || req.Pincode.Length != 6)
            {
                shippingFee = -1; // -1 indicates "needs address/pincode to calculate"
            }
            else
            {
                decimal totalActualWeight = 0;
                decimal totalVolumetricWeight = 0;
                foreach (var item in req.Items)
                {
                    var product = products[item.ProductId];
                    decimal actualGrams = product.WeightGrams ?? 500m;
                    decimal volGrams = ((product.LengthCm ?? 10m) * (product.WidthCm ?? 10m) * (product.HeightCm ?? 10m) / 5000m) * 1000m;
                    totalActualWeight += actualGrams * item.Quantity;
                    totalVolumetricWeight += volGrams * item.Quantity;
                }
                decimal maxWeightGrams = Math.Max(totalActualWeight, totalVolumetricWeight);
                decimal weightKg = Math.Max(0.05m, maxWeightGrams / 1000m);
                
                var rate = await _shiprocketService.EstimateShippingAsync(req.Pincode, weightKg, cod: 0);
                if (rate.HasValue)
                {
                    shippingFee = rate.Value;
                }
                else
                {
                    if (maxWeightGrams <= 0) maxWeightGrams = 500m;
                    decimal multiplier = Math.Ceiling(maxWeightGrams / 500m);
                    shippingFee = 50m + ((multiplier - 1m) * 20m);
                }
            }
        }

        return Ok(new
        {
            Subtotal = subtotal,
            ShippingFee = shippingFee,
            TotalAmount = shippingFee == -1 ? subtotal : subtotal + shippingFee
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.CustomerName) ||
            string.IsNullOrWhiteSpace(req.CustomerEmail) ||
            string.IsNullOrWhiteSpace(req.CustomerPhone) ||
            string.IsNullOrWhiteSpace(req.CustomerAddress) ||
            string.IsNullOrWhiteSpace(req.City) ||
            string.IsNullOrWhiteSpace(req.State) ||
            string.IsNullOrWhiteSpace(req.Pincode))
            return BadRequest(new { error = "Customer name, email, phone, full address (including city, state, pincode) are required." });

        // Phone validation – exactly 10 digits
        if (!PhoneRegex.IsMatch(req.CustomerPhone.Trim()))
            return BadRequest(new { error = "Phone number must be exactly 10 digits (no country code or symbols)." });

        if (req.Items == null || req.Items.Count == 0)
            return BadRequest(new { error = "Order must contain at least one item." });
        
        // Only UPI or Online allowed
        if (req.PaymentMethod != PaymentMethod.UPI && req.PaymentMethod != PaymentMethod.Online)
            return BadRequest(new { error = "Payment method must be UPI or Online." });


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

        var settings = await _db.AdminSettings.ToDictionaryAsync(s => s.Key, s => s.Value);
        var strategy = settings.GetValueOrDefault("ShippingStrategy", "Free");
        var flatRateStr = settings.GetValueOrDefault("FlatShippingRate", "0");
        if (!decimal.TryParse(flatRateStr, out decimal flatRate)) flatRate = 0m;

        decimal shippingFee = 0;
        if (strategy == "Free")
        {
            shippingFee = 0;
        }
        else if (strategy == "FlatRate")
        {
            shippingFee = flatRate;
        }
        else if (strategy == "Dynamic")
        {
            decimal totalActualWeight = 0;
            decimal totalVolumetricWeight = 0;
            foreach (var item in req.Items)
            {
                var product = products[item.ProductId];
                decimal actualGrams = product.WeightGrams ?? 500m; // default 500g if missing
                decimal volGrams = ((product.LengthCm ?? 10m) * (product.WidthCm ?? 10m) * (product.HeightCm ?? 10m) / 5000m) * 1000m;
                totalActualWeight += actualGrams * item.Quantity;
                totalVolumetricWeight += volGrams * item.Quantity;
            }
            decimal maxWeightGrams = Math.Max(totalActualWeight, totalVolumetricWeight);
            decimal weightKg = Math.Max(0.05m, maxWeightGrams / 1000m);

            var rate = await _shiprocketService.EstimateShippingAsync(req.Pincode, weightKg, req.PaymentMethod == PaymentMethod.UPI || req.PaymentMethod == PaymentMethod.Online ? 0 : 1);
            if (rate.HasValue)
            {
                shippingFee = rate.Value;
            }
            else
            {
                if (maxWeightGrams <= 0) maxWeightGrams = 500m;
                decimal multiplier = Math.Ceiling(maxWeightGrams / 500m);
                shippingFee = 50m + ((multiplier - 1m) * 20m); // Base 50 Rs for 500g, 20 Rs per extra 500g
            }
        }

        decimal totalAmount = subtotal + shippingFee;

        var order = new Order
        {
            PublicOrderNumber = GenerateOrderNumber(),
            CustomerName = req.CustomerName.Trim(),
            CustomerEmail = req.CustomerEmail.Trim(),
            CustomerPhone = req.CustomerPhone.Trim(),
            CustomerAddress = req.CustomerAddress.Trim(),
            City = req.City.Trim(),
            State = req.State.Trim(),
            Pincode = req.Pincode.Trim(),
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

        // We no longer send the email here. We wait until payment is verified.
        Console.WriteLine($"[Orders] Order {order.PublicOrderNumber} saved to DB with Status PendingPayment. Waiting for payment verification.");


        return Ok(new
        {
            order.Id,
            order.PublicOrderNumber,
            order.TotalAmount,
            order.Status,
            order.CustomerName,
            order.CustomerEmail,
            order.CustomerPhone,
            order.CustomerAddress
        });
    }

    // ── POST /api/orders/{id:guid}/pay ───────────────────────────────
    public sealed record PayOrderRequest(string TransactionId);

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> Pay(Guid id, [FromBody] PayOrderRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.TransactionId))
            return BadRequest(new { error = "Transaction ID is required." });

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound(new { error = "Order not found." });

        if (order.PaymentStatus == PaymentStatus.Verified)
            return BadRequest(new { error = "Payment is already verified for this order." });

        order.TransactionId = req.TransactionId.Trim();
        order.PaymentStatus = PaymentStatus.Verified;
        order.Status = OrderStatus.PaymentVerified;
        order.PaidAt = DateTimeOffset.UtcNow;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        var msg = new OrderMessage
        {
            OrderId = order.Id,
            Sender = "System",
            MessageText = $"Payment verified. Transaction ID: {order.TransactionId}"
        };
        _db.OrderMessages.Add(msg);

        await _db.SaveChangesAsync();

        // Send email alert to store owner now that the order is actually paid
        Console.WriteLine($"[Orders] Order {order.PublicOrderNumber} payment verified. Dispatching background email alert task...");
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                await emailService.SendNewOrderAlertToOwnerAsync(order);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Orders] ❌ Background email dispatch exception for order {order.PublicOrderNumber}: {ex.Message}");
                _logger.LogError(ex, "Failed to send new order email alert for {OrderNumber}", order.PublicOrderNumber);
            }
        });

        return Ok(new { success = true, order.PublicOrderNumber, order.Status, order.PaymentStatus });
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
            order.CustomerEmail,
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
            order.TrackingNumber,
            order.TrackingUrl,
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
            order.CustomerEmail,
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
            order.TrackingNumber,
            order.TrackingUrl,
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

    // ── WEBHOOK /api/orders/webhook/shiprocket ────────────────────────
    public sealed class ShiprocketWebhookPayload
    {
        public string awb { get; set; } = string.Empty;
        public string current_status { get; set; } = string.Empty;
        public string channel_order_id { get; set; } = string.Empty;
    }

    [HttpPost("webhook/shiprocket")]
    public async Task<IActionResult> ShiprocketWebhook([FromBody] ShiprocketWebhookPayload payload, [FromServices] Microsoft.Extensions.Logging.ILogger<PublicOrdersController> logger)
    {
        if (string.IsNullOrWhiteSpace(payload.awb))
        {
            return BadRequest();
        }

        var order = await _db.Orders.FirstOrDefaultAsync(o => o.TrackingNumber == payload.awb || o.PublicOrderNumber == payload.channel_order_id);
        
        if (order == null)
        {
            logger.LogWarning("Received Shiprocket webhook for unknown order. AWB: {Awb}, ChannelOrderId: {ChannelOrderId}", payload.awb, payload.channel_order_id);
            return Ok(); // Acknowledge to Shiprocket anyway so they don't retry unnecessarily
        }

        order.ShippingStatus = payload.current_status;

        if (payload.current_status.Equals("DELIVERED", StringComparison.OrdinalIgnoreCase))
        {
            order.Status = OrderStatus.Delivered;
            order.DeliveredAt = DateTimeOffset.UtcNow;
            
            var msg = new OrderMessage
            {
                OrderId = order.Id,
                Sender = "System",
                MessageText = "Order has been delivered."
            };
            _db.OrderMessages.Add(msg);
        }
        else if (payload.current_status.Equals("PICKED UP", StringComparison.OrdinalIgnoreCase) || payload.current_status.Equals("IN TRANSIT", StringComparison.OrdinalIgnoreCase) || payload.current_status.Equals("OUT FOR DELIVERY", StringComparison.OrdinalIgnoreCase))
        {
            if (order.Status == OrderStatus.Packed)
            {
                order.Status = OrderStatus.Dispatched;
                var msg = new OrderMessage
                {
                    OrderId = order.Id,
                    Sender = "System",
                    MessageText = $"Shipment status updated: {payload.current_status}."
                };
                _db.OrderMessages.Add(msg);
            }
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    private static string GenerateOrderNumber()
        => $"ORD-{DateTime.UtcNow.Year}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
}