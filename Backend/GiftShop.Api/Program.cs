using System.Text;
using GiftShop.Api.Configuration;
using GiftShop.Api.Middleware;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Options;
using GiftShop.Infrastructure;
using GiftShop.Infrastructure.Persistence;
using GiftShop.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using GiftShop.Api.Services;

// ── Load .env file (dev convenience; in prod, env vars take precedence) ─
DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);

// ── Configuration sources (env vars override appsettings.json) ──────────
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

// ── Services ─────────────────────────────────────────────────────────────
//builder.Services.AddControllers();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
// 💡 THIS LINE: This registers ISwaggerProvider and other required services
builder.Services.AddSwaggerGen();
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
    // Allow enums to be passed as strings (e.g. "UPI", "Verified")
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

// Infrastructure (DbContext, MemoryCache, Cloudinary, ProductCacheService)
builder.Services.AddInfrastructure(builder.Configuration);

// TOTP verification service for the admin 3-stage login pipeline
builder.Services.AddSingleton<IAdminTotpService, AdminTotpService>();

// Dashboard Activity service for the admin , being registered in here
builder.Services.AddScoped<IDashboardActivityService, DashboardActivityService>();

// CORS — allow Angular dev server and production origin
builder.Services.AddCors(options =>
{
    options.AddPolicy("GiftShopPolicy", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",
                "https://localhost:4200",
                "https://kalakaari-gifting.onrender.com") // replace with real prod URL
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

app.UseMiddleware<DashboardActivityMiddleware>(); // adding new custom built middleware for dashboard activity services to get showed in the dashboard.
//  the telemetry ping minimal API endpoint
// Telemetry ping endpoint (202 Accepted)
app.MapPost("/api/monitoring/ping", async (TelemetryPing ping, HttpContext context, IDashboardActivityService activityService) =>
{
    var ip = context.Connection.RemoteIpAddress?.ToString();
    var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault();
    var description = $"{ping.Action}: {ping.Metadata}";
    await activityService.LogActivityAsync(ip, forwardedFor, userAgent, description, AuditActionType.TelemetryPing);
    return Results.Accepted();
});

app.MapControllers();

/*
Everything being seeded and what happens if deleted
1. Categories (6 items)
Guard: if (!await context.Categories.AnyAsync(c => c.Slug == slug))
Behaviour if deleted: ✅ Will NOT come back. The check is per-slug. If you delete a category (e.g. "Accessories" with slug accessories), on next startup it checks AnyAsync(c => c.Slug == "accessories") — since it's gone, it will be re-seeded.
So yes, categories will return if deleted.

2. Mock Products (8 items)
Guard: if (await context.Products.AnyAsync(p => p.Slug == mp.Slug)) continue;
Behaviour if deleted: Same problem. If you delete the "Minimalist Leather Wallet" product (slug: minimalist-leather-wallet), on next cold start it checks for that slug, finds nothing, and re-seeds it along with its Unsplash image.
So yes, mock products will return if deleted.

3. Site Content — Text & Images (hero, manifesto, feature sections)
Guard: if (!await context.SiteContentItems.AnyAsync(i => i.ContentKey == key))
Behaviour if deleted: Same. Delete the hero heading text from the admin panel? Next startup re-seeds it. Delete the default Unsplash hero slideshow images? They come back.
But note: If the admin edits text (not deletes the row), it won't reseed because the key still exists. The problem is only on row deletion.

4. Admin User
Guard: if (!await context.AdminUsers.AnyAsync())
Behaviour if deleted: If ALL admin users are deleted, a default one is re-created from env vars. This is actually intentional and good — don't touch this one.

5. IsTotpEnabled AdminSetting
Guard: if (!await context.AdminSettings.AnyAsync(s => s.Key == "IsTotpEnabled"))
Behaviour if deleted: Re-seeded to true. But you'd never delete this from the admin panel so it's fine.

The fix — make all seeding truly one-time
The solution is a seed-lock table — a simple DB flag that records whether the initial seed has already run. If the flag exists, skip all seeding entirely. This means: run once on first deploy, never again regardless of what the admin deletes.
*/
// ── Database migration + seeding on startup ──────────────────────────────
// All seeding is idempotent ( checks before inserting)so it is safe to re-run on every startup-nothing is duplicated. 
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    //var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        logger.LogInformation("[Startup] Database migrations applied.");

        // ── Defensive column guard ────────────────────────────────────────
        // Adds any schema changes that may not have been applied yet due to
        // missing Designer.cs files in earlier migration runs. These are all
        // idempotent (IF NOT EXISTS / IF EXISTS) so safe to run every startup.
        //
        // WHY: EF Core needs both the .cs and .Designer.cs file for each migration
        // to correctly track which migrations have been applied. If the Designer.cs
        // was missing when `dotnet run` was first executed, the migration was recorded
        // in __EFMigrationsHistory but the ALTER TABLE was never actually run against
        // the real database — leaving the code and DB schema out of sync.
        //
        // This raw SQL block bridges that gap permanently regardless of history state.
        await context.Database.ExecuteSqlRawAsync(@"
            ALTER TABLE public.""SiteContentItems""
                ADD COLUMN IF NOT EXISTS ""ExternalImageUrl"" character varying(700) NULL;

            ALTER TABLE public.""Products""
                ALTER COLUMN ""CategoryId"" DROP NOT NULL;
        ");
        logger.LogInformation("[Startup] Defensive schema guard applied.");

        // ── SEED LOCK — only seed once, ever ────────────────────────────
        // Check for a special AdminSetting that acts as a one-time seed flag.
        // Once set, all seed blocks below are permanently skipped- even if the 
        // admin delets products, categories, or site content from the panel.
        const string SeedLockKey = "InitialSeedCompleteled";
        bool alreadySeeded = await context.AdminSettings.AnyAsync(s => s.Key == SeedLockKey);

        if (!alreadySeeded)
        {
            logger.LogInformation("[Startup] First-time seed starting ...");


            // Seed default categories (matching the mock products in the frontend)
            // These are seeded once so the admin can immediately assign categories when
            // creating a product . the frontend mock data uses thee same category names.
            var defaultCategories = new[]
            {
                ("Accessories",  "accessories",  "Bags, wallets, keychains, and wearable accessories"),
                ("Home Decor",   "home-decor",   "Vases, candles, frames, and decorative items for the home"),
                ("Kitchen",      "kitchen",      "Mugs, cups, and kitchen accessories"),
                ("Stationery",   "stationery",   "Notebooks, journals, pens, and desk accessories"),
                ("Jewellery",    "jewellery",    "Handcrafted rings, pendants, earrings, and necklaces"),
                ("Gifting",      "gifting",      "Curated gift sets, hampers, and ready-to-gift items"),
            };

            foreach (var (name, slug, desc) in defaultCategories)
            {
                if (!await context.Categories.AnyAsync(c => c.Slug == slug))
                {
                    context.Categories.Add(new GiftShop.Domain.Entities.Category
                    {
                        Name = name,
                        Slug = slug,
                        Description = desc,
                        IsActive = true
                    });
                }
            }
            await context.SaveChangesAsync();
            logger.LogInformation("[Startup] Default categories seeded.");

            // Fetch all categories into a lookup for product seeding below
            var catLookup = await context.Categories.ToDictionaryAsync(c => c.Slug , c => c.Id );
            
            // ── 2. MOCK PRODUCTS (the 8 from app-state.service.ts) ──────────
            // Seeded exactly once per product slug. The admin can toggle IsActive,
            // edit, or delete these just like any other product. The Unsplash
            // image URLs are stored directly as ImageUrl (no Cloudinary PublicId).
            var mockProducts = new[]
            {
                new
                {
                    Slug = "minimalist-leather-wallet",
                    Title = "Minimalist Leather Wallet",
                    ShortDescription = "Slim, full-grain leather bifold wallet",
                    Description = "A hand-stitched bifold leather wallet crafted from full-grain vegetable-tanned leather. Ages beautifully with everyday use and holds up to 8 cards plus cash.",
                    Price = 2499m,
                    CategorySlug = "accessories",
                    SortOrder = 1,
                    ImageUrl = "https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "handwoven-keychain",
                    Title = "Handwoven Keychain",
                    ShortDescription = "Premium cotton-thread macramé keychain",
                    Description = "A beautifully handwoven keychain made from premium cotton threads in earthy tones. Each piece is unique — no two are exactly the same. Perfect for gifting.",
                    Price = 499m,
                    CategorySlug = "accessories",
                    SortOrder = 2,
                    ImageUrl = "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "ceramic-mug-slate",
                    Title = "Ceramic Mug — Slate",
                    ShortDescription = "Handthrown mug with reactive slate-grey glaze",
                    Description = "Thrown by hand on a potter's wheel and fired at high temperature with a reactive slate-grey glaze that produces unique speckle patterns on every cup. Holds 350ml.",
                    Price = 799m,
                    CategorySlug = "kitchen",
                    SortOrder = 3,
                    ImageUrl = "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "wooden-photo-frame",
                    Title = "Wooden Photo Frame",
                    ShortDescription = "Reclaimed teakwood frame, 4×6 inch",
                    Description = "Handcrafted solid-wood photo frame made from reclaimed teakwood. Each frame has unique wood-grain character. Fits standard 4×6 inch photographs. Includes easel back.",
                    Price = 1199m,
                    CategorySlug = "home-decor",
                    SortOrder = 4,
                    ImageUrl = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "handmade-notebook",
                    Title = "Handmade Notebook",
                    ShortDescription = "Hand-bound journal, 160 pages, linen cover",
                    Description = "A hand-bound journal with a textured linen cover in sage green. Filled with 160 pages of acid-free ivory paper. Includes a ribbon bookmark and elastic closure.",
                    Price = 599m,
                    CategorySlug = "stationery",
                    SortOrder = 5,
                    ImageUrl = "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "minimal-pendant",
                    Title = "Minimal Pendant",
                    ShortDescription = "Recycled sterling silver teardrop pendant",
                    Description = "An elegantly minimal pendant hand-formed from recycled sterling silver. The subtle hammered texture catches light beautifully. Comes on an 18-inch silver chain.",
                    Price = 1199m,
                    CategorySlug = "jewellery",
                    SortOrder = 6,
                    ImageUrl = "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "soy-wax-candle-set",
                    Title = "Soy Wax Candle Set",
                    ShortDescription = "Set of 3 hand-poured soy candles",
                    Description = "A set of three hand-poured soy wax candles with wooden wicks that crackle gently as they burn. Scents: Sandalwood & Amber, Jasmine & Vetiver, and Cedarwood & Vanilla.",
                    Price = 1450m,
                    CategorySlug = "home-decor",
                    SortOrder = 7,
                    ImageUrl = "https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=1000&auto=format&fit=crop"
                },
                new
                {
                    Slug = "glass-vase-botanical",
                    Title = "Glass Vase — Botanical",
                    ShortDescription = "Hand-blown glass vase, botanical green",
                    Description = "A striking hand-blown glass vase with subtle botanical-green tones that shift with the light. Each piece is entirely unique. Height 22cm, opening 6cm. Perfect for dried florals.",
                    Price = 1850m,
                    CategorySlug = "home-decor",
                    SortOrder = 8,
                    ImageUrl = "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?q=80&w=1000&auto=format&fit=crop"
                },
            };

            foreach (var mp in mockProducts)
            {
                if (await context.Products.AnyAsync(p => p.Slug == mp.Slug)) continue; // skip if already seeded

                catLookup.TryGetValue(mp.CategorySlug, out var catId);
                var product = new Product
                {
                    Title = mp.Title, Slug = mp.Slug,
                    ShortDescription = mp.ShortDescription,
                    Description = mp.Description,
                    Price = mp.Price,
                    CategoryId = catId == Guid.Empty ? null : catId,
                    SortOrder = mp.SortOrder,
                    IsActive = true
                };
                context.Products.Add(product);
                await context.SaveChangesAsync(); // save to get the generated Id

                // Add primary image using the Unsplash URL directly
                context.ProductImages.Add(new ProductImage
                {
                    ProductId = product.Id,
                    ImageUrl = mp.ImageUrl,
                    PublicId = null, // no Cloudinary public_id for seeded images
                    AltText = mp.Title,
                    IsPrimary = true,
                    SortOrder = 0
                });
                await context.SaveChangesAsync();
            }
            logger.LogInformation("[Startup] Mock products seeded.");

            // ── 3. SITE CONTENT (text + default section images) ──────────────
            // Text content: seeded once. Admin edits these via the Homepage panel.
            // Image content: seeded with ExternalImageUrl pointing to Unsplash defaults.
            // Admin can later upload real images which override via BinaryValue.
            var contentSeeds = new List<(string key, string section, SiteContentItemKind kind, string? text, string? extUrl, int sort)>
            {
                // ── Hero text ──
                ("hero.heading",    "hero", SiteContentItemKind.Text, "Welcome to", null, 0),
                ("hero.subheading", "hero", SiteContentItemKind.Text, "Kalakaari Gifting", null, 1),
                ("hero.copy",       "hero", SiteContentItemKind.Text,
                    "Discover the Charm of Handmade Art at Your Doorstep — thoughtfully crafted, beautifully wrapped, and designed to turn ordinary days into unforgettable celebrations.", null, 2),

                // ── Hero images (slideshow) ──
                ("hero.image.0", "hero", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=2000&auto=format&fit=crop", 0),
                ("hero.image.1", "hero", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1607344645866-009c320b63e0?q=80&w=2000&auto=format&fit=crop", 1),
                ("hero.image.2", "hero", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=2000&auto=format&fit=crop", 2),

                // ── Manifesto text ──
                ("manifesto.quote", "manifesto", SiteContentItemKind.Text,
                    "We believe that a gift shouldn't just be an object; it should be a tangible reflection of a connection. Every artistic piece in our boutique is hand-selected and crafted in limited numbers, ensuring that whatever you choose to share is as unique and wonderful as the person receiving it.", null, 0),

                // ── Feature-1 text + images ──
                ("feature-1.para1", "feature-1", SiteContentItemKind.Text,
                    "Unlike mass-produced store items, our fancy gift collections are born from local studio sessions. From initial sketch to final polish, each item carries distinct artistic character and absolute material perfection.", null, 0),
                ("feature-1.image.0", "feature-1", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1000&auto=format&fit=crop", 0),
                ("feature-1.image.1", "feature-1", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1000&auto=format&fit=crop", 1),

                // ── Feature-2 text + images ──
                ("feature-2.para1", "feature-2", SiteContentItemKind.Text,
                    "Presentation is half the magic of a thoughtful surprise. Every order is meticulously packaged in our signature keepsake boxing with a blank or custom-written message card, ready to delight them the exact second it arrives.", null, 0),
                ("feature-2.image.0", "feature-2", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=1000&auto=format&fit=crop", 0),
                ("feature-2.image.1", "feature-2", SiteContentItemKind.Image, null,
                    "https://images.unsplash.com/photo-1607344645866-009c320b63e0?q=80&w=1000&auto=format&fit=crop", 1),
            };

            foreach (var (key, section, kind, text, extUrl, sort) in contentSeeds)
            {
                if (!await context.SiteContentItems.AnyAsync(i => i.ContentKey == key))
                {
                    context.SiteContentItems.Add(new SiteContentItem
                    {
                        ContentKey = key, SectionName = section, Kind = kind,
                        TextValue = text, ExternalImageUrl = extUrl,
                        AltText = kind == SiteContentItemKind.Image ? section + " image" : null,
                        SortOrder = sort, IsActive = true
                    });
                }
            }
            await context.SaveChangesAsync();
            logger.LogInformation("[Startup] Site content seeded.");

            // ── Write the seed lock LAST, only after everything succeeded ─
            context.AdminSettings.Add(new AdminSetting
            {
                Key = SeedLockKey,
                Value = DateTimeOffset.UtcNow.ToString("o") // ISO timestamp of when seeding ran
            });
            await context.SaveChangesAsync();
            logger.LogInformation("[Startup] Initial seed complete. Seed lock written.");
        }
        else
        {
            logger.LogInformation("[Startup] Seed Lock found - skipping initial seed .");
        }


        // ── Admin user + IsTotpEnabled stay OUTSIDE the seed lock ────────
        // These are self-healing — if someone accidentally deletes the only admin
        // account or the TOTP setting, they should come back. They're not content.
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
            logger.LogInformation("[Startup] Default admin user seeded.");
        }

        // Adding IsTotpEnabled setting to db with default value as true .
        if (!await context.AdminSettings.AnyAsync(s => s.Key == "IsTotpEnabled"))
        {
            context.AdminSettings.Add(new AdminSetting
            {
               Key = "IsTotpEnabled" ,
               Value = "true" // TOTP enabled by default, matching previous behaviour.
            });

            await context.SaveChangesAsync();
            logger.LogInformation("[Startup] Default AdminSetting 'IsTotpEnabled seeded");
        }
    }
    catch (Exception ex)
    {
        //var logger = services.GetRequiredService<ILogger<Program>>();
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
