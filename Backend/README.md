# GiftShop Backend

ASP.NET Core clean-architecture backend for the Kalakaari / GiftShop storefront.

## Projects

- `GiftShop.Domain` - entities and enums.
- `GiftShop.Application` - application abstractions.
- `GiftShop.Infrastructure` - EF Core + PostgreSQL.
- `GiftShop.Api` - web host, configuration, and future controllers.

## Configuration

Copy `.env.example` to `.env` for local development, or override the same keys with environment variables in production.

The runtime uses this fallback chain:

1. `.env` file values when present.
2. `appsettings.json` / environment-specific JSON files.
3. Environment variables provided by the host.

## Database

The default connection string matches the backend work log:

```text
Host=localhost;Port=5432;Database=giftshop;Username=postgres;Password=root;
```

## Common commands

```bash
dotnet build Backend/GiftShop.Backend.slnx
dotnet ef migrations add InitialCreate --project Backend/GiftShop.Infrastructure --startup-project Backend/GiftShop.Api
dotnet ef database update --project Backend/GiftShop.Infrastructure --startup-project Backend/GiftShop.Api
```
