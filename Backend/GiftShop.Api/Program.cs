using System.Text;
using GiftShop.Api.Configuration;
using GiftShop.Api.Middleware;
using GiftShop.Infrastructure.Options;
using GiftShop.Infrastructure;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;

// ── Load .env file (dev convenience; in prod, env vars take precedence) ─
DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);

// ── Configuration sources (env vars override appsettings.json) ──────────
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

// ── Services ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Options
builder.Services.Configure<AdminSettingsOptions>(builder.Configuration.GetSection(AdminSettingsOptions.SectionName));
builder.Services.PostConfigure<AdminSettingsOptions>(o => o.Normalize());
builder.Services.Configure<CloudinarySettingsOptions>(builder.Configuration.GetSection(CloudinarySettingsOptions.SectionName));
builder.Services.Configure<JwtSettingsOptions>(builder.Configuration.GetSection(JwtSettingsOptions.SectionName));

// JSON serialization
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.WriteIndented = false;
});

// Infrastructure (DbContext, MemoryCache, Cloudinary, ProductCacheService)
builder.Services.AddInfrastructure(builder.Configuration);

// CORS — allow Angular dev server and production origin
builder.Services.AddCors(options =>
{
    options.AddPolicy("GiftShopPolicy", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",
                "https://localhost:4200",
                "https://giftshop.vercel.app") // replace with real prod URL
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// JWT Authentication
var jwtSection = builder.Configuration.GetSection(JwtSettingsOptions.SectionName);
var jwtSecret = jwtSection["SecretKey"] ?? "giftshop-dev-secret-key-min-32-chars!";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"] ?? "GiftShop.Api",
            ValidAudience = jwtSection["Audience"] ?? "GiftShop.Admin",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// Rate limiting on /api/admin — using ASP.NET Core native limiter
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("AdminLoginPolicy", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        limiter.QueueLimit = 0;
    });
});

// ── Build app ─────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Healthcheck (public, no auth) ────────────────────────────────────────
app.MapGet("/healthz", () => Results.Ok(new
{
    status = "ok",
    service = "GiftShop.Api",
    environment = app.Environment.EnvironmentName,
    timestamp = DateTimeOffset.UtcNow
}));

// ── Middleware pipeline ──────────────────────────────────────────────────
// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Health check endpoint for this service
app.MapGet("/isrunning" , () => "Backend service for gift shop is running. " );


app.UseCors("GiftShopPolicy");
app.UseHttpsRedirection();
app.UseTimeLogging(); // Custom middleware to log request processing time
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// ── Admin route branch: IP whitelist + pre-auth key enforcement ──────────
// This branch catches EVERY request under /api/admin before it reaches controllers.
// The middleware does: IP whitelist → 24h ban check → cooldown check → pre-auth key.
/*
app.Map("/api/admin", adminBranch =>
{
    adminBranch.UseMiddleware<AdminIpWhitelistMiddleware>();

    // Hand off to the main controller pipeline after middleware passes
    adminBranch.Run(async context =>
    {
        // This terminal handler is never reached for valid requests because
        // MapControllers() below handles routing globally. We just need the
        // middleware to fire for the /api/admin prefix.
        await context.Response.WriteAsJsonAsync(new { error = "Not Found" });
    });
});
*/
// FIX: Use UseWhen() instead of app.Map(...).Run(...).
// The previous app.Map("/api/admin", branch => { branch.UseMiddleware<>(); branch.Run(...) })
// pattern created a TERMINAL branch — requests matched the prefix, ran the middleware,
// then hit the .Run() handler and NEVER reached MapControllers() below.
// UseWhen() runs the middleware conditionally and then CONTINUES the main pipeline,
// so controllers receive the request normally after the middleware passes.
app.UseWhen(
    context => context.Request.Path.StartsWithSegments("/api/admin"),
    adminBranch => adminBranch.UseMiddleware<AdminIpWhitelistMiddleware>()
);

app.MapControllers();

// ── Database migration + seeding on startup ──────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        Console.WriteLine("[Startup] Database migrations applied.");

        // Seed admin user if none exists
        if (!await context.AdminUsers.AnyAsync())
        {
            var adminOpts = builder.Configuration.GetSection(AdminSettingsOptions.SectionName);
            var userName = adminOpts["AdminUserName"] ?? "admin";
            var password = adminOpts["AdminPassword"] ?? "admin@2026";

            context.AdminUsers.Add(new GiftShop.Domain.Entities.AdminUser
            {
                UserName = userName,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = "SuperAdmin",
                DisplayName = "Store Owner",
                IsActive = true
            });
            await context.SaveChangesAsync();
            Console.WriteLine("[Startup] Default admin user seeded.");
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "[Startup] Database migration/seed failed.");
        throw;
    }
}

// ── Warm up product RAM cache ─────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var cacheService = scope.ServiceProvider.GetRequiredService<IProductCacheService>();
    await cacheService.RefreshCacheAsync();
}

// ── Load active IP bans from DB into memory ───────────────────────────────
await AdminBanRegistry.WarmUpFromDatabaseAsync(app.Services);

app.Run();