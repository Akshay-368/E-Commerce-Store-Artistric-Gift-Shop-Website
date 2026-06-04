# Project Implementation Guide

Date: June 4, 2026

## 1. What This Repository Currently Is

This workspace now contains the Angular storefront, Angular SSR host, an admin shell UI, and a new `Backend/` ASP.NET Core solution scaffolded with clean architecture layers and EF Core PostgreSQL support.

The important current fact is:

- Public storefront behavior is mostly implemented in Angular with local in-memory state.
- Admin pages exist as navigable shells, but they are mostly placeholders.
- The backend now has domain entities, an `ApplicationDbContext`, dotenv-backed configuration, and an initial EF Core migration applied to PostgreSQL.

## 2. What Is Already Implemented

### Public storefront

- Sticky navbar with brand, order bag, and track-order trigger.
- Hero, manifesto, feature sections, highlights, and catalog sections.
- Product cards and product detail drawer.
- Cart drawer with checkout form.
- Order tracking modal.
- Search, category filtering, and incremental "load more" behavior in the catalog.

### Frontend state behavior

- Product data is currently hardcoded inside the Angular service.
- Cart state is stored in an Angular service and persisted to browser `localStorage`.
- Order creation, tracking, and messages are simulated in memory inside the client service.
- Admin login is mock-based and uses browser storage, not a backend auth endpoint.

### Admin shell

- Routes exist for dashboard, analytics, products, categories, media, homepage, reviews, orders, payments, invoices, tracking, automation, settings, and security.
- The shell layout, sidebar, top bar, and reusable UI blocks are already present.
- Each admin page is currently a WIP placeholder with descriptive modal text.

## 3. What Is Missing Right Now

### Backend

The backend solution exists, but the feature layer is still incomplete. The remaining backend work now is mostly product/admin/API behavior, not project setup. Missing or still to build:

- API controllers or minimal endpoints.
- Request/response DTOs.
- Authentication and authorization backed by the server.
- File upload handling.
- Order persistence.
- Product/category persistence.
- Review moderation persistence.
- Invoice generation.
- Scheduled automation workers.
- Admin settings storage.

The database foundation is now present under `Backend/GiftShop.Infrastructure/Persistence`, and the first migration has already been created and applied.

### Database

There is no PostgreSQL schema or EF Core `DbContext` yet. That means there are no real tables for:

- Products
- Product images
- Categories
- Orders
- Order items
- Order messages
- Reviews
- Admin users
- Site settings
- Audit logs

### Admin workflow

The admin UI is not yet connected to live data. It cannot currently:

- Create or edit products.
- Upload or reorder images.
- Edit homepage copy.
- Change site settings.
- Update order statuses from a database.
- Moderate reviews.
- Generate invoices from real orders.
- Configure automation or security settings.

## 4. Recommended Target Architecture

Use a clean-architecture ASP.NET Core solution rather than microservices.

### Suggested solution structure

```text
GiftShop.Backend/
  src/
    GiftShop.Domain/
    GiftShop.Application/
    GiftShop.Infrastructure/
    GiftShop.Api/
```

### Responsibilities by layer

- `GiftShop.Domain`: entities, value objects, enums, domain rules.
- `GiftShop.Application`: use cases, DTOs, validators, interfaces, orchestration.
- `GiftShop.Infrastructure`: EF Core, PostgreSQL, Cloudinary, email/SMS adapters, repositories, file storage.
- `GiftShop.Api`: controllers/minimal APIs, auth, middleware, Swagger, request pipeline.

This separation keeps the business rules testable and prevents the Angular app from becoming responsible for data logic.

## 5. Database and EF Core Plan

### Core entities

The minimal schema should support the current storefront and the admin shell.

#### Products

- `ProductId`
- `Title`
- `Slug`
- `Description`
- `Price`
- `IsActive`
- `CategoryId`
- `CreatedAt`
- `UpdatedAt`

#### ProductImages

- `ProductImageId`
- `ProductId`
- `ImageUrl`
- `PublicId`
- `IsPrimary`
- `SortOrder`

#### Categories

- `CategoryId`
- `Name`
- `Slug`
- `IsActive`

#### Orders

- `OrderId`
- `PublicOrderNumber`
- `CustomerName`
- `CustomerPhone`
- `CustomerAddress`
- `Status`
- `PaymentStatus`
- `TotalAmount`
- `CreatedAt`
- `UpdatedAt`

#### OrderItems

- `OrderItemId`
- `OrderId`
- `ProductId`
- `TitleSnapshot`
- `PriceSnapshot`
- `Quantity`

#### OrderMessages

- `OrderMessageId`
- `OrderId`
- `SenderType`
- `MessageText`
- `CreatedAt`

#### Reviews

- `ReviewId`
- `ProductId`
- `OrderId`
- `Rating`
- `ReviewComment`
- `IsAnonymous`
- `ApprovedAt`

### ImagesAndTextOfThePublicSideWebPage
- `ImagesAndTextOfThePublicSideWebPageId`
- `IsImage`
- `Text`
- `ImageBinaryForm`
- `LocationAtTheUserEndPage`
- `OrderInTheSlideShowInWhichTheImageWillBeDisplayedInTheSectionItIsLocatedAt`

(Note the columns names are suggestive only and can be changed into something more compact and explicit and they are only here to make sure the dev knows that this table will store the images like icons or the images that the page needs to display but are not the product images, product images will not be stored in db, except only a very few main key products which can be stored here, but it's primarily for the images of the other section of the page only. And the text that is showed in the public side page , including headings , text (like in hero section , or in story section, etc) will be stored directly in here and can be modified by admin)

### SystemAudit
-  `SystemAuditId`
This table is for logging the activities and changes across the db .
Something like this just for an example 
```
-- This is specifically for tracking the changes in the system by admins and tracing back any issues to specific records and users by the Admin 
Create Table SystemAuditLogs(
    LogId int Primary Key Identity (1,1) ,
    TableName VARCHAR (100) Not Null , -- Name of the table where the action was performed
    ActionType varchar (100) Not Null check (ActionType in ('Insert', 'Update', 'Delete' ,  'Lockdown', 'Elevated Permissions', 'Auto-Revoke','CREATE_TABLE', 'ALTER_TABLE', 'DROP_TABLE', 'TRUNCATE_TABLE' )), -- Type of action performed
    RecordId int  Null , -- Id of the record that was affected by the action , and this will store  the primary Key of all the other tables, so that I can trace back the changes to the specific record in the specific table
    UserId int Null Foreign Key References Users ( UserId) ,
    ActionDate DateTime Not Null Default GetDate(),
    OldValue NVARCHAR (MAX) Null , -- Old value before the change, which can be null for Insert actions. Also Using MAX instead of 255 to store full row snapshots
    NewValue NVARCHAR (MAX) Null -- New value after the change, which can be null for Delete actions
);

And thus there should be triggers in postgres db that should happen when any change occur
one mssql specific correlation could be this 

GO
CREATE TRIGGER trg_AuditPatients
ON Patients
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON; -- Prevents extra rows affected messages from interfering with C#

    DECLARE @ActionType VARCHAR(10);
    DECLARE @RecordId INT;
    Declare @UserId Int = Cast ( Session_Context(N'UserId') As Int) ;

    -- 1. Determine the Action Type
    IF EXISTS (SELECT * FROM inserted) AND EXISTS (SELECT * FROM deleted)
        SET @ActionType = 'Update';
    ELSE IF EXISTS (SELECT * FROM inserted)
        SET @ActionType = 'Insert';
    ELSE
        SET @ActionType = 'Delete';

    -- 2. Log the change
    INSERT INTO SystemAuditLogs (TableName, ActionType, RecordId, UserId, ActionDate, OldValue, NewValue)
    SELECT 
        'Patients',
        @ActionType,
        COALESCE(i.PatientId, d.PatientId), -- Get ID from whichever table has it
        @UserId,
        GETDATE(),
        -- Use FOR JSON PATH to turn the whole row into a string (Requires SQL 2016+)
        (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), 
        (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.PatientId = d.PatientId;
END;
GO

```
Though it can be left pending for later since triggers can't be directly applied by the ef core . So keep this table of audit for later and focus on the rest of the tables.

#### Admin users and settings

- `AdminUsers` for login and roles.
- `SiteSettings` for homepage copy, brand text, UPI details, and theme variables.
- `AuditLogs` for admin change history.

### EF Core setup rules

- Use `DbContext` in the Infrastructure layer.
- Keep entity configuration in dedicated configuration classes.
- Use migrations from day one.
- Seed initial admin credentials, categories, and sample content only once.
- Store business content in the database, not in Angular files.

### Storage strategy

- PostgreSQL stores structured business data.
- PostgreSQL stores structured business data and small binary assets (non-product site images such as icons, hero backgrounds, and other brand art that are not product galleries).
- Cloudinary stores product images and gallery assets; the database stores Cloudinary `PublicId`, delivery URL, and image metadata.

## 6. Backend Setup Plan

### Environment and configuration

Use standard ASP.NET Core configuration sources:

- `appsettings.json`
- `appsettings.Development.json`
- environment variables
- optional `.env` loading for local development only

Suggested configuration sections:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "..."
  },
  "Jwt": {
    "Issuer": "...",
    "Audience": "...",
    "SigningKey": "..."
  },
  "Cloudinary": {
    "CloudName": "...",
    "ApiKey": "...",
    "ApiSecret": "..."
  },
  "AdminSettings": {
    "AllowedIps": ["127.0.0.1", "::1"]
  }
}
```

### Startup pipeline

The backend should include:

- forwarded headers if deployed behind a proxy.
- CORS configured for the Angular origin.
- authentication and authorization.
- rate limiting for login and sensitive endpoints.
- IP whitelist middleware for the admin branch if that remains a requirement.
- Swagger for development.

### Security note

The IP whitelist should be treated as an additional defense layer, not the only gate. Real protection should come from:

- authenticated admin accounts,
- JWT or cookie-based auth,
- role-based authorization,
- rate limiting,
- audit logging.

### Admin IP whitelist & pre-auth gateway

The `Backend-Work-Progress.md` file includes a concrete gateway pattern to protect the admin branch. Key recommendations to implement:

- Fork the pipeline for admin endpoints using `app.Map("/api/admin", ...)` and attach a short-circuiting middleware only to that branch so public endpoints never run admin-specific checks.
- Read the effective client IP from `X-Forwarded-For` when behind a proxy, and fallback to `context.Connection.RemoteIpAddress`.
- Store the allowed IP list in configuration (`AdminSettings:AllowedIps`) and use `IOptionsMonitor<AdminSettings>` so changes propagate at runtime without restarts.
- Add a pre-auth secret key step (e.g. `AdminSettings:SecretPreAuthKey`) that must be provided before the login controller is accessible. Track wrong attempts with escalating delays (3 / 8 / 15 minutes) and a final 24-hour ban.
- Use a thread-safe `ConcurrentDictionary<string, DateTime>` as an in-memory ban registry for single-instance deployments and use an asynchronous write-behind to persist bans to the DB for restart resilience.
- For multi-instance production, move the ban registry and IP store to a shared cache (Redis) or a centralized configuration provider.

Behavioral notes for middleware:

- Immediately deny requests when the IP is not in the allowed set.
- Short-circuit the request pipeline with clear 401/403 JSON responses and logs for suspicious attempts.
- If a pre-auth secret reaches final-failure thresholds, add the source IP to the ban registry (in-memory) and persist the event asynchronously.

Note: use `IOptionsMonitor` and environment variables (`.env` or cloud provider configuration) so non-technical admins can update allowed IPs via the host's config UI (Azure App Configuration, Render env vars, etc.). Include a safe fallback default IP (for example `192.168.1.7`) only for development or emergency access, and document it in deployment notes.

## Product performance & in-memory cache strategy

The backend work log recommends an eager in-memory cache for the product catalog to deliver near-instant public reads while keeping costs minimal:

- Implement a singleton `IProductCacheService` that warms the full product catalog (with image metadata) at server startup via a single EF Core `.AsNoTracking()` query.
- Store the DTO list in `IMemoryCache` or a thread-safe in-memory structure and serve paginated/search requests from RAM.
- Expose simple endpoints: `GET /api/products?page=..` slices the in-memory array, `GET /api/products/search?q=..` runs an in-memory LINQ filter.
- On admin product mutations, call `IProductCacheService.RefreshCacheAsync()` after DB commits to refresh the snapshot.
- This avoids Redis for MVP single-instance deployments and keeps the public read path extremely fast on low-cost hosts.

Implementation notes:

- Warm cache during `Program.cs` startup using a scoped `DbContext` inside the cache service.
- Use long TTLs (e.g., 24 hours) and explicit refresh on content change.
- Optionally return the entire catalog once to the Angular client on first load for client-side instantaneous search on very small catalogs.

## 7. API Surface To Build

### Public storefront API

- `GET /api/products`
- `GET /api/products/{id}`
- `GET /api/categories`
- `POST /api/orders`
- `GET /api/orders/{publicOrderNumber}`
- `GET /api/orders/lookup?phone=...`
- `POST /api/orders/{id}/messages`
- `POST /api/reviews`

### Admin API

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/{id}`
- `DELETE /api/admin/products/{id}`
- `POST /api/admin/products/{id}/images`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/{id}/status`
- `GET /api/admin/reviews`
- `PATCH /api/admin/reviews/{id}/approve`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/media`
- `DELETE /api/admin/media/{id}`
- `GET /api/admin/invoices/{orderId}`

## 8. How the Angular App Needs To Change

The Angular app should move from local mock state to API-driven state.

### Replace hardcoded data

- Move products, categories, homepage copy, and settings out of Angular services.
- Load them from backend services instead of static arrays.
- Keep only temporary UI state in Angular.

### Replace client-side mock order logic

- `createOrder()` should call the backend and return the server-generated order number.
- `findOrderById()` and `findOrdersByPhone()` should call tracking endpoints.
- `addMessage()` should persist to the server.

### Replace mock admin auth

- The current `AdminAuthService` should call the backend login endpoint.
- Store only the server-issued session token or cookie.
- Use real server claims/roles for route protection.
- Keep the SSR-safe browser checks, but remove the placeholder credential logic.

### Replace WIP pages with forms and grids

Each admin page should become a real CRUD workspace:

- Products page: table, filters, create/edit drawer, image manager, publish toggle.
- Categories page: category list, add/edit/delete.
- Media page: upload queue, image picker, reordering, primary-image selector.
- Homepage page: CMS-like editing for hero text, banners, highlights, and CTA labels.
- Orders page: searchable order table, status pipeline, notes, refunds, invoice action.
- Payments page: payment status review and manual verification.
- Reviews page: moderation queue and featured-review toggle.
- Settings page: brand info, contact details, UPI details, SEO metadata, theme settings.
- Security page: admin accounts, roles, access logs, allowed IPs, login policy.

### Angular architecture changes

Recommended frontend additions:

- `api/` services for products, orders, admin, media, settings.
- typed DTO interfaces mirroring the backend.
- route resolvers or store-based fetching for admin pages.
- reactive forms for all edit screens.
- upload components for images.
- shared table, drawer, and modal components for reuse.
- centralized error handling and loading states.

### Data flow change

Current flow:

- Angular service stores everything locally.

Target flow:

- Angular UI calls backend API.
- Backend validates, writes to PostgreSQL, and returns DTOs.
- Angular updates UI from returned server state.

## 9. How the Admin Can Easily Change Content

The goal is to make the admin feel like a simple content portal, not a developer tool.

### For text and homepage content

- Use editable form sections for hero copy, highlight cards, FAQ blocks, and footer copy.
- Store all copy in `SiteSettings` or a structured CMS table.
- Render previews in the admin UI before saving.

### For photos

- Use an image uploader that sends files to the backend.
- Backend uploads to Cloudinary (only if the image is of the product, otherwise it can be directly stored in db) and stores metadata.
- Admin can mark the primary image, reorder gallery images, and remove unused ones.

### For products

- Product creation should be a single drawer or modal workflow.
- Support title, description, category, price, active/published state, and gallery.
- Product edits should update the storefront automatically after save.

### For orders

- Orders should be searchable by order number, phone, and status.
- Admin should be able to move an order through the lifecycle.
- Notes and messages should be attached to the order record.
- Invoices should be generated from the persisted order snapshot.

### For business settings

- UPI ID, business name, contact number, shipping copy, and theme tokens should be editable in the settings page.
- Sensitive settings should live in environment variables when they are truly deployment-specific.
- Business content that changes often should live in the database.

## 10. Suggested Build Order

### Phase 1: Backend foundation

- Create the ASP.NET Core solution.
- Add Clean Architecture projects.
- Configure PostgreSQL and EF Core.
- Add JWT auth and admin user seed.
- Add Swagger and health checks.

### Phase 2: Public storefront APIs

- Products, categories, and order creation.
- Order tracking and lookup endpoints.
- Public review submission.

### Phase 3: Admin CRUD

- Products, categories, homepage content, settings, orders, reviews.
- Replace Angular mock pages with real forms and tables.

### Phase 4: Media and automation

- Cloudinary upload integration.
- order-status automation hooks.
- invoice generation.
- cleanup background jobs.

### Phase 5: Security and polish

- Admin audit logs.
- IP whitelist middleware if still required.
- rate limiting.
- role-based authorization.
- better loading states, error handling, and validation in Angular.

## 11. Current Risk Summary

- The storefront currently looks functional, but the data is not durable because it is still client-side.
- The admin portal currently exists only as a shell, so nothing there can actually manage the store yet.
- The backend does not exist in this workspace, so every server-side blueprint item still needs to be implemented.

## 12. Bottom Line

The project is now a well-structured Angular storefront with admin scaffolding, SSR support, and a live backend/database foundation. The next real milestone is building the API surface, auth flow, cache-backed catalog reads, and the admin CRUD experiences for products, media, homepage text, orders, reviews, and settings.

