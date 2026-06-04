using GiftShop.Api.Configuration;
using GiftShop.Api.Options;
using GiftShop.Infrastructure;
using GiftShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;

DotEnvLoader.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<AdminSettingsOptions>(builder.Configuration.GetSection(AdminSettingsOptions.SectionName));
builder.Services.PostConfigure<AdminSettingsOptions>(options => options.Normalize());
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.WriteIndented = true;
});
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}


app.MapGet("/healthz", () => Results.Ok(new
{
    status = "ok",
    service = "GiftShop.Api",
    environment = app.Environment.EnvironmentName,
}));

// Configure the Http request pipeline ...
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// Automatically apply migrations on startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        
        // This will check the database, find any pending migrations, and run them
        await context.Database.MigrateAsync();
        
        Console.WriteLine("Database migrations applied successfully.");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating the database.");
        // Optional: Fail fast and stop the app if the database schema is broken
        throw;
    }
}

app.Run();
