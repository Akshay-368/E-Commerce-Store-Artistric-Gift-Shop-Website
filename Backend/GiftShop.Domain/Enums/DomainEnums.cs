namespace GiftShop.Domain.Enums;

public enum OrderStatus
{
    PendingPayment = 0,
    PaymentVerified = 1,
    Packed = 2,
    Dispatched = 3,
    Delivered = 4,
    Cancelled = 5
}

public enum PaymentStatus
{
    Pending = 0,
    Verified = 1,
    Failed = 2,
    Refunded = 3
}

public enum PaymentMethod
{
    UPI = 0,
    Cash = 1,
    PayOnDelivery = 2
}

public enum SiteContentItemKind
{
    Text = 0,
    Image = 1
}

public enum AuditActionType
{
    Insert = 0,
    Update = 1,
    Delete = 2,
    Lockdown = 3,
    ElevatedPermissions = 4,
    AutoRevoke = 5,
    CreateTable = 6,
    AlterTable = 7,
    DropTable = 8,
    TruncateTable = 9
}
