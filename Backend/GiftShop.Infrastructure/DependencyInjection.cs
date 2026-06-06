using GiftShop.Infrastructure.Options;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GiftShop.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=giftshop;Username=postgres;Password=root;";

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
            });
        });

        // In-memory cache (used by ProductCacheService)
        services.AddMemoryCache();

        // Cloudinary (reads from IOptions<CloudinarySettingsOptions>)
        services.AddScoped<ICloudinaryService, CloudinaryService>();

        // Product RAM cache — singleton so the warmed data lives for the app lifetime
        services.AddSingleton<IProductCacheService, ProductCacheService>();

        return services;
    }
}