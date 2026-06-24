using GiftShop.Application.Abstractions;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GiftShop.Infrastructure.Persistence;

public sealed class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    public DbSet<OrderMessage> OrderMessages => Set<OrderMessage>();

    public DbSet<Review> Reviews => Set<Review>();

    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();

    public DbSet<SiteContentItem> SiteContentItems => Set<SiteContentItem>();

    public DbSet<AdminAccessBan> AdminAccessBans => Set<AdminAccessBan>();

    public DbSet<SystemAuditLog> SystemAuditLogs => Set<SystemAuditLog>();

    public DbSet<SocialLink> SocialLinks => Set<SocialLink>();
    public DbSet<PaymentDetail> PaymentDetails => Set<PaymentDetail>();

    public DbSet<AdminSetting> AdminSettings => Set<AdminSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("public");

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.Property(x => x.Name).IsRequired();
            entity.HasMany(x => x.Products)
                .WithOne(x => x.Category)
                .HasForeignKey(x => x.CategoryId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.Property(x => x.Title).IsRequired();
            entity.Property(x => x.Description).IsRequired();
            entity.Property(x => x.Price).HasPrecision(18, 2);
            entity.HasMany(x => x.Images)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Reviews)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.OrderItems)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.Property(x => x.VideoUrl).HasMaxLength(700);
            entity.Property(x => x.VideoPublicId).HasMaxLength(240);
        });

        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.Property(x => x.ImageUrl).IsRequired();
            entity.HasIndex(x => new { x.ProductId, x.SortOrder });
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasIndex(x => x.PublicOrderNumber).IsUnique();
            entity.HasIndex(x => x.CustomerPhone);
            entity.Property(x => x.Status).HasConversion<string>();
            entity.Property(x => x.PaymentStatus).HasConversion<string>();
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.ShippingFee).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.HasMany(x => x.Items)
                .WithOne(x => x.Order)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Messages)
                .WithOne(x => x.Order)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Reviews)
                .WithOne(x => x.Order)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(x => x.TitleSnapshot).IsRequired();
            entity.Property(x => x.PriceSnapshot).HasPrecision(18, 2);
        });

        modelBuilder.Entity<OrderMessage>(entity =>
        {
            entity.Property(x => x.Sender).IsRequired();
            entity.Property(x => x.MessageText).IsRequired();
        });

        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasIndex(x => new { x.ProductId, x.OrderId }).IsUnique();
            entity.Property(x => x.Rating).HasDefaultValue(5);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasIndex(x => x.UserName).IsUnique();
            entity.Property(x => x.Role).HasDefaultValue("SuperAdmin");
        });

        modelBuilder.Entity<SiteContentItem>(entity =>
        {
            entity.HasIndex(x => x.ContentKey).IsUnique();
            entity.Property(x => x.Kind).HasConversion<string>();
            entity.Property(x => x.TextValue).HasMaxLength(600);
            entity.Property(x => x.BinaryValue).HasColumnType("bytea");
            entity.Property(x => x.ExternalImageUrl).HasMaxLength(700);
            entity.Property(x => x.VideoUrl).HasMaxLength(700);
            entity.Property(x => x.VideoPublicId).HasMaxLength(240);
        });

        modelBuilder.Entity<AdminAccessBan>(entity =>
        {
            entity.HasIndex(x => x.IpAddress).IsUnique();
            entity.Property(x => x.IpAddress).IsRequired();
        });

        modelBuilder.Entity<SystemAuditLog>(entity =>
        {
            entity.HasIndex(x => new { x.TableName, x.ActionType, x.ActionDate });
            entity.Property(x => x.ActionType).HasConversion<string>();
        });

        modelBuilder.Entity<SocialLink>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Icon).HasMaxLength(20);
        });

        modelBuilder.Entity<PaymentDetail>(entity =>
        {
            entity.HasIndex(x => x.Key).IsUnique();
            entity.Property(x => x.Key).HasMaxLength(120);
        });

        modelBuilder.Entity<AdminSetting>(entity =>
        {
            entity.HasIndex(x => x.Key).IsUnique();
            entity.Property(x => x.Key).IsRequired();
            entity.Property(x => x.Value).IsRequired();
        });

    }
}
