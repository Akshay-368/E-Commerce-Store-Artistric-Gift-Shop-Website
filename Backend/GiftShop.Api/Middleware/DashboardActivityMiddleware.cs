using GiftShop.Api.Services;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Services;

namespace GiftShop.Api.Middleware;

public class DashboardActivityMiddleware
{
    private readonly RequestDelegate _next;

    public DashboardActivityMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IDashboardActivityService activityService, IProductCacheService productCache)
    {
        // Let the downstream pipeline run
        await _next(context);

        // Only log successful (2xx) responses to certain paths
        if (context.Response.StatusCode < 200 || context.Response.StatusCode >= 300)
            return;

        var path = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method;

        // Skip ping endpoint (logged by its own handler) and static/non‑API paths
        if (path.StartsWith("/api/monitoring/ping") || !path.StartsWith("/api/"))
            return;
        // Skip Swagger & health checks
        if (path.StartsWith("/swagger") || path == "/healthz" || path == "/isrunning")
            return;

        string description = TranslateToDescription(method, path, context, productCache);

        var ip = context.Connection.RemoteIpAddress?.ToString();
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault();

        // Fire and forget the logging (do not block the response)
        _ = activityService.LogActivityAsync(ip, forwardedFor, userAgent, description, AuditActionType.DashboardActivity);
    }

    private string TranslateToDescription(string method, string path, HttpContext context, IProductCacheService productCache)
    {
        // Public product endpoints
        if (path.Equals("/api/products", StringComparison.OrdinalIgnoreCase) && method.Equals("GET", StringComparison.OrdinalIgnoreCase))
            return "Someone is browsing the storefront main catalog";

        if (path.StartsWith("/api/products/") && method.Equals("GET", StringComparison.OrdinalIgnoreCase))
        {
            // Extract product ID from route: /api/products/{id}
            var segments = path.Split('/');
            if (segments.Length >= 3)
            {
                var productIdStr = segments[3]; // after api/products/
                if (Guid.TryParse(productIdStr, out var productId))
                {
                    var product = productCache.GetById(productId);
                    if (product != null)
                        return $"Someone is viewing: {product.Title}";
                    return "Someone is viewing a product";
                }
            }
            return "Someone is viewing a product";
        }

        if (path.StartsWith("/api/search", StringComparison.OrdinalIgnoreCase) && method.Equals("GET", StringComparison.OrdinalIgnoreCase))
        {
            var query = context.Request.Query["q"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(query))
                return $"Someone searched for: '{query}'";
            return "Someone searched for products";
        }

        // Order endpoints
        if (path.Equals("/api/orders", StringComparison.OrdinalIgnoreCase) && method.Equals("POST", StringComparison.OrdinalIgnoreCase))
            return "A customer placed a new order";

        if (path.StartsWith("/api/orders/by-phone/") && method.Equals("GET", StringComparison.OrdinalIgnoreCase))
            return "Someone is tracking an order";

        // Admin product endpoints
        if (path.StartsWith("/api/admin/products", StringComparison.OrdinalIgnoreCase))
        {
            if (method.Equals("POST", StringComparison.OrdinalIgnoreCase))
                return "Admin created a new product";
            if (method.Equals("PUT", StringComparison.OrdinalIgnoreCase))
                return "Admin updated a product";
            if (method.Equals("DELETE", StringComparison.OrdinalIgnoreCase))
                return "Admin deleted a product";
            if (method.Equals("GET", StringComparison.OrdinalIgnoreCase))
                return "Admin viewed product list";
        }

        // Admin category endpoints
        if (path.StartsWith("/api/admin/categories", StringComparison.OrdinalIgnoreCase))
        {
            if (method.Equals("POST", StringComparison.OrdinalIgnoreCase))
                return "Admin created a new category";
            if (method.Equals("PUT", StringComparison.OrdinalIgnoreCase))
                return "Admin updated a category";
            if (method.Equals("DELETE", StringComparison.OrdinalIgnoreCase))
                return "Admin deleted a category";
            if (method.Equals("GET", StringComparison.OrdinalIgnoreCase))
                return "Admin viewed categories";
        }

        // Admin orders
        if (path.StartsWith("/api/admin/orders", StringComparison.OrdinalIgnoreCase))
        {
            if (method.Equals("GET", StringComparison.OrdinalIgnoreCase))
                return "Admin viewed orders";
            if (method.Equals("PUT", StringComparison.OrdinalIgnoreCase))
                return "Admin updated an order";
            if (method.Equals("DELETE", StringComparison.OrdinalIgnoreCase))
                return "Admin deleted an order"; // unlikely but catch
        }

        // Admin content, social, payment, etc.
        if (path.StartsWith("/api/admin/", StringComparison.OrdinalIgnoreCase))
        {
            // Generic admin action
            return $"Admin performed {method} on {path}";
        }

        // Fallback for any other /api/... request
        return $"HTTP {method} request to {path}";
    }
}