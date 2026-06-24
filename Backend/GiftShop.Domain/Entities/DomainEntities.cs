using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GiftShop.Domain.Common;
using GiftShop.Domain.Enums;

namespace GiftShop.Domain.Entities;

public sealed class Category : EntityBase
{
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(240)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public sealed class Product : EntityBase
{
    [MaxLength(160)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(180)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    public decimal Price { get; set; }

    [MaxLength(120)]
    public string? ShortDescription { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    // NULLABLE: A product may exist without a category (e.g. "Uncategorized").
    // This avoids the FK violation when the admin creates a product without picking a category.
    public Guid? CategoryId { get; set; }

    public Category? Category { get; set; }

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();

    public ICollection<Review> Reviews { get; set; } = new List<Review>();

    [MaxLength(700)]
    public string? VideoUrl { get; set; }

    [MaxLength(240)]
    public string? VideoPublicId { get; set; }
}

public sealed class ProductImage : EntityBase
{
    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    /// <summary>
    /// Cloudinary CDN URL (preferred) or any public https URL.
    /// For seeded mock products this holds the Unsplash URL directly.
    /// </summary>
    [MaxLength(600)]
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// Cloudinary public_id - null for external/Unsplash images.
    /// </summary>
    [MaxLength(240)]
    public string? PublicId { get; set; }

    [MaxLength(200)]
    public string? AltText { get; set; }

    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }
}

public sealed class Order : EntityBase
{
    [MaxLength(40)]
    public string PublicOrderNumber { get; set; } = string.Empty;

    [MaxLength(180)]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string CustomerPhone { get; set; } = string.Empty;

    [MaxLength(500)]
    public string CustomerAddress { get; set; } = string.Empty;

    public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    public decimal Subtotal { get; set; }

    public decimal ShippingFee { get; set; }

    public decimal TotalAmount { get; set; }

    public DateTimeOffset? PaidAt { get; set; }

    public DateTimeOffset? DeliveredAt { get; set; }

    [MaxLength(100)]
    public string? TransactionId {get;set;}

    //  Payment method chosen by customer
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.UPI;

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();

    public ICollection<OrderMessage> Messages { get; set; } = new List<OrderMessage>();

    public ICollection<Review> Reviews { get; set; } = new List<Review>();
}

public sealed class OrderItem : EntityBase
{
    public Guid OrderId { get; set; }

    public Order? Order { get; set; }

    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    [MaxLength(160)]
    public string TitleSnapshot { get; set; } = string.Empty;

    public decimal PriceSnapshot { get; set; }

    public int Quantity { get; set; }
}

public sealed class OrderMessage : EntityBase
{
    public Guid OrderId { get; set; }

    public Order? Order { get; set; }

    [MaxLength(40)]
    public string Sender { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string MessageText { get; set; } = string.Empty;
}

public sealed class Review : EntityBase
{
    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    public Guid OrderId { get; set; }

    public Order? Order { get; set; }

    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(1200)]
    public string? ReviewComment { get; set; }

    public bool IsAnonymous { get; set; }

    public bool IsApproved { get; set; }

    public DateTimeOffset? ApprovedAt { get; set; }
}

public sealed class AdminUser : EntityBase
{
    [MaxLength(120)]
    public string UserName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(80)]
    public string Role { get; set; } = "SuperAdmin";

    [MaxLength(180)]
    public string? DisplayName { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset? LastLoginAt { get; set; }
}

public sealed class SiteContentItem : EntityBase
{
    [MaxLength(120)]
    public string ContentKey { get; set; } = string.Empty;

    [MaxLength(120)]
    public string SectionName { get; set; } = string.Empty;

    public SiteContentItemKind Kind { get; set; }

    /// <summary>
    /// For Text items : The text value.
    /// For Image items : Used as caption/alt override.
    /// </summary>
    [MaxLength(600)]
    public string? TextValue { get; set; }

    /// <summary>
    /// Binary image data (uploaded by admin). When present takes priority over ExternalImageUrl.
    /// </summary>
    public byte[]? BinaryValue { get; set; }

    [MaxLength(100)]
    public string? MimeType { get; set; }

    [MaxLength(200)]
    public string? DisplayLocation { get; set; }

    [MaxLength(200)]
    public string? AltText { get; set; }

    [MaxLength(700)]
    public string? VideoUrl { get; set; }

    [MaxLength(240)]
    public string? VideoPublicId { get; set; }

    /// <summary>
    /// External/CDN image Url (Cloudinary, Unsplash , etc).
    /// Used as fallback when BinaryValue is null - allows seeding default images without storing binary blobs. The admin can later replace these with proper uploads.
    /// </summary>
    [MaxLength(700)]
    public string? ExternalImageUrl {get;set;}

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class AdminAccessBan : EntityBase
{
    [MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;

    public int FailedAttempts { get; set; }

    public DateTimeOffset? LastAttemptAt { get; set; }

    public DateTimeOffset? BanUntilUtc { get; set; }

    [MaxLength(240)]
    public string? Reason { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SystemAuditLog : EntityBase
{
    [MaxLength(120)]
    public string TableName { get; set; } = string.Empty;

    public AuditActionType ActionType { get; set; }

    public DateTimeOffset ActionDate { get; set; } = DateTimeOffset.UtcNow;

    public long? RecordId { get; set; }

    public Guid? UserId { get; set; }

    [MaxLength(4000)]
    public string? OldValue { get; set; }

    [MaxLength(4000)]
    public string? NewValue { get; set; }

    [MaxLength(240)]
    public string? UserName { get; set; }

    [MaxLength(45)]
    public string? RemoteIpAddress { get; set; }

    [MaxLength(45)]
    public string? ForwardedFor { get; set; }

    [MaxLength(500)]
    public string? UserAgent { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }
}

// Telemetry ping record for  ping endponint in program.cs to utilise.
public record TelemetryPing(string Action, string Metadata);

// ... existing code ...

public sealed class SocialLink : EntityBase
{
    [MaxLength(20)]
    public string Icon { get; set; } = "📎";   // emoji or icon class

    [MaxLength(80)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Url { get; set; } = string.Empty;

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class PaymentDetail : EntityBase
{
    [MaxLength(120)]
    public string Key { get; set; } = string.Empty;   // e.g. "Phone", "UPI ID"

    [MaxLength(300)]
    public string Value { get; set; } = string.Empty;

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class AdminSetting : EntityBase
{
    [MaxLength(120)]
    public string Key { get; set; } = string.Empty;   // e.g. "IsTotpEnabled"

    [MaxLength(500)]
    public string Value { get; set; } = string.Empty;  // e.g. "true" or "false"
}