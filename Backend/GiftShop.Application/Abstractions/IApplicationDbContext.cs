using GiftShop.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Application.Abstractions;

public interface IApplicationDbContext
{
    DbSet<Category> Categories { get; }

    DbSet<Product> Products { get; }

    DbSet<ProductImage> ProductImages { get; }

    DbSet<Order> Orders { get; }

    DbSet<OrderItem> OrderItems { get; }

    DbSet<OrderMessage> OrderMessages { get; }

    DbSet<Review> Reviews { get; }

    DbSet<AdminUser> AdminUsers { get; }

    DbSet<SiteContentItem> SiteContentItems { get; }

    DbSet<AdminAccessBan> AdminAccessBans { get; }

    DbSet<SystemAuditLog> SystemAuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
