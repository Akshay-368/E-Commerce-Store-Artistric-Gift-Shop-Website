# Kalakaari Gifting — Complete Project Technical Report

> **Audience:** Dev team, future contributors, stakeholder reference  
> **Codebase snapshot date:** June 18 2026  
> **Design constraint that governs every decision:** *A casual startup that wants a fully functional e-commerce website at near-zero recurring cost, with minimum spending on development, and operable by a non-technical single admin without a dev team present.*

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Repository Structure](#2-repository-structure)
3. [Full Technology Stack](#3-full-technology-stack)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Data Model & Database](#6-data-model--database)
7. [Security Architecture](#7-security-architecture)
8. [Performance Techniques](#8-performance-techniques)
9. [Activity Monitoring & Telemetry System](#9-activity-monitoring--telemetry-system)
10. [External Integrations & Services](#10-external-integrations--services)
11. [Admin Portal — Features & Status](#11-admin-portal--features--status)
12. [Public Storefront — Features & Status](#12-public-storefront--features--status)
13. [Cost Architecture](#13-cost-architecture)
14. [Migration History](#14-migration-history)
15. [Environment Variables Reference](#15-environment-variables-reference)
16. [Known Gaps, Planned Work & Next Steps](#16-known-gaps-planned-work--next-steps)
17. [Developer Notes & Gotchas](#17-developer-notes--gotchas)

---

## 1. Project Summary

**Kalakaari Gifting** is a handmade-goods e-commerce site built for a single non-technical admin to manage a small artisan product catalog, accept UPI/online orders, track fulfillment, manage homepage content, monitor live site activity, and control security settings — all without a developer in the loop for day-to-day operations.

The system is two applications sharing one repository:

| Application | Technology | Deployment |
|---|---|---|
| Frontend | Angular 21 SPA with SSR | Vercel (free Hobby tier) |
| Backend | ASP.NET Core 10 Web API | Render / Railway (free tier) |
| Database | PostgreSQL | Neon / Supabase / Railway free tier |

There are no microservices, no message queues, no Redis, no separate CDN servers. The stack is deliberately flat, shallow, and built to cost ₹0/month in recurring infrastructure (excluding domain).

---

## 2. Repository Structure

```
New folder/
│
├── Gift-Shop/                           ← Angular 21 frontend
│   └── src/app/
│       ├── components/                  ← Public storefront UI
│       │   ├── home.component.ts        ← Main page (hero, catalog, features)
│       │   ├── navbar.component.ts
│       │   ├── product-card.component.ts
│       │   ├── product-detail-drawer.component.ts
│       │   ├── cart-drawer.component.ts
│       │   ├── section-slideshow.component.ts
│       │   └── track-order-modal.component.ts
│       ├── admin/
│       │   ├── components/
│       │   │   ├── admin-login.component.ts    ← 2/3-stage login flow
│       │   │   ├── admin-shell.component.ts    ← Sidebar + layout
│       │   │   ├── admin-orders.component.ts
│       │   │   └── admin-ui.component.ts       ← Shared UI primitives
│       │   ├── pages/
│       │   │   ├── admin-dashboard.component.ts  ← Activity logs + DB size ✅ LIVE
│       │   │   ├── admin-security.component.ts   ← TOTP toggle + status ✅ LIVE
│       │   │   ├── admin-products.component.ts
│       │   │   ├── admin-categories.component.ts
│       │   │   ├── admin-orders.component.ts
│       │   │   ├── admin-payments.component.ts
│       │   │   ├── admin-invoices.component.ts
│       │   │   ├── admin-homepage.component.ts
│       │   │   ├── admin-analytics.component.ts  ← WIP
│       │   │   ├── admin-automation.component.ts ← WIP
│       │   │   ├── admin-reviews.component.ts    ← WIP
│       │   │   ├── admin-tracking.component.ts   ← WIP
│       │   │   ├── admin-settings.component.ts   ← WIP
│       │   │   └── admin-media.component.ts      ← WIP
│       │   ├── services/
│       │   │   ├── admin-auth.service.ts         ← JWT, pre-auth key, TOTP toggle
│       │   │   ├── admin-api.services.ts         ← All API calls incl. dashboard
│       │   │   └── admin-orders-state.service.ts
│       │   └── guards/
│       │       └── admin.auth.guard.ts
│       └── services/
│           ├── app-state.service.ts              ← Global public store
│           └── telemetry.service.ts              ← Frontend activity pings
│
└── Backend/
    ├── GiftShop.Domain/
    │   ├── Entities/DomainEntities.cs    ← All 13 entities + AdminSetting
    │   ├── Enums/DomainEnums.cs          ← Incl. new DashboardActivity enums
    │   └── Common/EntityBase.cs
    ├── GiftShop.Application/
    │   └── Abstractions/IApplicationDbContext.cs
    ├── GiftShop.Infrastructure/
    │   ├── Persistence/
    │   │   ├── ApplicationDbContext.cs
    │   │   └── Migrations/              ← 8 migrations total
    │   ├── Services/
    │   │   ├── CloudinaryService.cs
    │   │   ├── ProductCacheService.cs
    │   │   └── PdfInvoiceService.cs
    │   └── Options/AdminSettingsOptions.cs
    └── GiftShop.Api/
        ├── Controllers/
        │   ├── AdminDashboardController.cs   ← NEW: activity logs, DB size, delete
        │   ├── AdminAuthController.cs        ← UPDATED: TOTP toggle + totp-status
        │   ├── AdminCategoriesController.cs
        │   ├── AdminOrdersController.cs
        │   ├── AdminPaymentDetailsController.cs
        │   ├── AdminProductsController.cs
        │   ├── AdminSiteContentController.cs
        │   ├── AdminSocialLinksController.cs
        │   ├── PublicOrdersController.cs
        │   ├── PublicProductsController.cs
        │   └── PublicSiteContentController.cs
        ├── Middleware/
        │   ├── AdminIpWhitelistMiddleware.cs   ← Pre-auth + IP ban + cooldown
        │   ├── DashboardActivityMiddleware.cs  ← NEW: HTTP → human-readable log
        │   └── TimeLogging.cs
        ├── Services/
        │   ├── Adminotpservice.cs
        │   └── DashboardActivityService.cs     ← NEW: log writer + TOTP guard
        └── Program.cs
```

---

## 3. Full Technology Stack

### Frontend

| Concern | Library / Tool | Version | Notes |
|---|---|---|---|
| Framework | Angular | 21.2 | Standalone components throughout; no NgModule |
| Language | TypeScript | 5.9 | Strict mode |
| Rendering | `@angular/ssr` | 21.2.5 | Node/Express SSR server |
| HTTP | `HttpClient` + `withFetch()` | built-in | Native Fetch API under the hood |
| Styling | Tailwind CSS v4 + inline component styles | 4.1.12 | PostCSS plugin; no config file needed |
| State | Angular Signals + `BehaviorSubject` | — | No NgRx; deliberately minimal |
| Forms | Angular `FormsModule` (template-driven) | — | |
| Build | `@angular/build` (esbuild) | 21.2.5 | Fast incremental builds |
| SSR server | Express 5 | 5.1.0 | Serves SSR HTML + static assets |
| Telemetry | Native `fetch` with `keepalive: true` | — | `TelemetryService` — silent fail |
| Testing | Vitest | 4.0.8 | Configured; minimal coverage so far |
| Package mgr | npm | 11.12.1 | Declared in `packageManager` field |

### Backend

| Concern | Library / Tool | Version | Notes |
|---|---|---|---|
| Runtime | .NET | 10 | `net10.0` target |
| Framework | ASP.NET Core Web API | 10.0.5 | Controllers-based |
| ORM | EF Core (Npgsql provider) | 10.0.5 | Code-first migrations |
| Database | PostgreSQL | ≥ 14 | Free-tier compatible |
| Auth | JWT Bearer (HMAC-SHA256) | 10.0.5 | `Microsoft.AspNetCore.Authentication.JwtBearer` |
| Password hashing | BCrypt.Net-Next | 4.0.3 | Default work factor (12) |
| TOTP | Otp.NET | 1.4.0 | RFC 6238, SHA-1, 30 s step, 6 digits |
| Image CDN | Cloudinary SDK | 1.26.2 | Free 25 credits/month tier |
| PDF generation | QuestPDF Community | free | Invoice on demand |
| Rate limiting | ASP.NET Core native `RateLimiter` | built-in | Fixed window, 5 req/min on login |
| Env loading | DotNetEnv | 3.1.1 | `.env` file for local dev |
| In-memory cache | `Microsoft.Extensions.Caching.Memory` | 10.0.0 | Product RAM cache singleton |
| API docs | Swashbuckle (Swagger) | 10.1.7 | Dev-only |

---

## 4. Frontend Architecture

### 4.1 Rendering Strategy: SSR + Client Hydration

Angular SSR renders the full page HTML server-side on the first request. The browser receives meaningful HTML immediately (fast FCP, SEO-friendly), then Angular hydrates it into a live reactive application.

**Key fix in place:** `withNoHttpTransferCache()` is passed to `provideClientHydration()`. Without this, Angular's SSR state transfer was intercepting admin API calls made during server rendering (where `localhost:5000` is unreachable from Vercel's Node environment), causing the browser to never re-issue them. This fix ensures all API calls are always fresh browser-side requests.

### 4.2 Standalone Component Architecture

Every component is `standalone: true`. No `AppModule`. Dependencies are declared per-component via `imports: [...]`. This enables tree-shaking at the component level, straightforward lazy-loading, and reduced circular dependency risk.

### 4.3 State Management

No NgRx. State is managed at two levels:

**Global public state (`AppStateService`):** A singleton service using `BehaviorSubject` streams for the product list (loaded once on app init), cart contents (in-memory), site content (hero/feature text and images), and order tracking modal state.

**Admin state:** Each admin page manages its own local state using Angular `signal()`. The `AdminOrdersStateService` is a small shared service enabling the orders list and order detail components to share state without prop-drilling.

### 4.4 Routing

```
/                  → HomeComponent (public storefront)
/admin/login       → AdminLoginComponent (2 or 3-stage auth)
/admin/**          → AdminShellComponent (guarded by adminAuthGuard)
  /dashboard       → Activity logs, DB size, delete with TOTP
  /products        → Full CRUD + Cloudinary images
  /categories      → CRUD + toggle
  /orders          → Full order management + invoice PDF
  /payments        → Payment details CRUD
  /invoices        → Invoice list + download
  /media           → WIP
  /homepage        → CMS text + image editor
  /reviews         → WIP
  /security        → TOTP toggle (live)
  /settings        → WIP
  /tracking        → WIP
  /analytics       → WIP
  /automation      → WIP
```

The `adminAuthGuard` reads the JWT from `sessionStorage`, checks the `expiresAt` timestamp client-side, and redirects to `/admin/login` if expired or absent — no server round-trip needed.

### 4.5 Admin Authentication Flow (Frontend)

The login component dynamically fetches the current TOTP enabled/disabled state from `GET /api/admin/totp-status` on load and shows either 2 or 3 stage indicators accordingly.

**Stage 1 — Pre-auth Secret Key:** Admin enters a 16-char secret key. Sent as `X-Admin-PreAuth-Key` header. Stored in `sessionStorage` after success for all subsequent requests.

**Stage 2 — TOTP (conditional):** If enabled, admin enters 6-digit code from their authenticator app. Can be skipped if TOTP has been disabled via the Security panel.

**Stage 3 — Username + Password:** BCrypt-verified credentials. On success, a signed JWT is stored in `sessionStorage` with an `expiresAt` timestamp.

Cooldown timers from failed attempts persist to `localStorage` so a browser refresh does not reset them — the admin still sees the countdown.

### 4.6 Telemetry Service

`TelemetryService` is an Angular singleton that sends lightweight `POST /api/monitoring/ping` requests using `fetch` with `keepalive: true`. This flag ensures the request is completed even if the user navigates away before the network call finishes. Errors are silently swallowed — telemetry must never break the UI.

```typescript
trackUserAction(action: string, metadata: string): void {
  fetch(url, { method: 'POST', body: payload, keepalive: true })
    .catch(() => {}); // silent fail
}
```

The backend receives these pings at `POST /api/monitoring/ping` (a minimal API endpoint) and writes them to `SystemAuditLogs` with `ActionType = TelemetryPing`.

### 4.7 Image Optimization

The `OptimizedUrl` property on `ProductImageDto` automatically injects `/upload/f_auto,q_auto/` into Cloudinary URLs server-side. Every `<img>` tag uses `optimizedUrl`, ensuring:
- `f_auto` → WebP for browsers that support it, JPEG/PNG otherwise
- `q_auto` → Best quality/size tradeoff chosen by Cloudinary's CDN automatically

---

## 5. Backend Architecture

### 5.1 Layer Structure

```
GiftShop.Domain         → Pure entities, enums, EntityBase. Zero dependencies.
GiftShop.Application    → IApplicationDbContext abstraction only.
GiftShop.Infrastructure → EF Core context, migrations, external services, options.
GiftShop.Api            → Controllers, middleware, services, DI root, Program.cs.
```

This is intentionally lean. CQRS, MediatR, domain events, and repositories are absent. For a single-admin system with a small catalog they would add complexity without benefit.

### 5.2 Middleware Pipeline (ordered)

```
CORS (GiftShopPolicy — strict origin allowlist)
  ↓
HTTPS Redirection
  ↓
TimeLogging (custom — logs request duration)
  ↓
Rate Limiter (5 req/min fixed window on /api/admin login)
  ↓
Authentication (JWT Bearer)
  ↓
Authorization
  ↓
DashboardActivityMiddleware (NEW — runs AFTER response, logs every 2xx API call)
  ↓
[Conditional via UseWhen] AdminIpWhitelistMiddleware
    (only fires for /api/admin/* paths)
    Checks: IP ban → cooldown → pre-auth key header
  ↓
Controller routing (MapControllers)
  ↓
Minimal API: POST /api/monitoring/ping (telemetry receiver)
```

**`UseWhen` vs `app.Map` (important):** `app.Map("/api/admin", branch => { branch.UseMiddleware<>(); branch.Run(...) })` creates a *terminal* branch — requests never reach `MapControllers()`. The fix is `app.UseWhen(predicate, branch => branch.UseMiddleware<>())`, which is conditional but non-terminal.

**`DashboardActivityMiddleware` runs post-response:** It calls `await _next(context)` first, then fires logging asynchronously. Only 2xx responses are logged. Swagger, healthz, and `/isrunning` are filtered out. This is fire-and-forget (`_ = activityService.LogActivityAsync(...)`) so logging never delays the HTTP response.

### 5.3 Admin Auth Controller — Updated Endpoints

**GET `/api/admin/totp-status` (public, no pre-auth required)**
New endpoint. Returns `{ totpEnabled: bool }` by reading the `AdminSettings` table. Called by the Angular login component on load to decide whether to render 2 or 3 stage indicators. Intentionally public — knowing TOTP is on or off is not a security leak; attackers still need the pre-auth key regardless.

**POST `/api/admin/preauth`**
Middleware validates the `X-Admin-PreAuth-Key` header before this ever runs. The controller simply returns `{ success: true }`.

**POST `/api/admin/verify-totp`**
Checks if TOTP is enabled first — if disabled, returns `{ gatewayPassed: true }` immediately (no-op). Otherwise validates the 6-digit code via `IAdminTotpService`.

**POST `/api/admin/login`**
400 ms artificial delay always. Additional 600 ms on failure. BCrypt.Verify(). Issues HMAC-SHA256 signed JWT.

**POST `/api/admin/totp-toggle` [Authorize required]**
New endpoint. Requires:
1. Valid JWT (enforced by `[Authorize]`)
2. Confirmation phrase exactly matching `"I, Admin wants to toggle it on/off"`
3. Fresh valid TOTP code — **even when disabling TOTP**, so a stolen JWT alone cannot silently disable the security stage

Persists the new `IsTotpEnabled` value to the `AdminSettings` table in PostgreSQL (survives server restarts). Defaults to `true` if the row doesn't exist yet.

### 5.4 Dashboard Controller — Three Endpoints

**GET `/api/admin/dashboard/activity?page=1&pageSize=50` [Authorize]**
Returns paginated `SystemAuditLogs` ordered by most-recent-first. Projects only the fields needed for the dashboard table: `id`, `actionDate`, `remoteIpAddress`, `forwardedFor`, `userAgent`, `description`, `actionType`. After a successful fetch, also logs the fetch itself (`"Admin fetched activity logs"`).

**DELETE `/api/admin/dashboard/activity` [Authorize]**
Secured deletion of activity log entries. Two-step validation:
1. Exact confirmation phrase: `"I confirm, that I as the admin, wants to delete the entries of the activities of the dashboard"`
2. Fresh TOTP code validated by `IDashboardActivityService.VerifyTotpForDeletionAsync()`

Uses a separate TOTP attempt counter (`DashboardActivityService.TotpAttempts`) independent of the login TOTP counter. Failed attempts trigger exponential cooldowns (2ˢᵗ attempt: 2 min, 3rd: 4 min, 4th: 8 min...) and ban after 3 wrong codes. If `Ids` is `null`, deletes all logs; otherwise deletes only the specified GUIDs.

**Known quirk:** EF Core 10.0.5 + Npgsql preview has a bug translating `req.Ids.Contains(l.Id)` into a SQL `ANY` expression that the `SqlNullabilityProcessor` cannot handle. The fix is to load all logs into memory first and filter with `List<Guid>.Contains()` in C#. Documented in a code comment. Safe because the activity table stays small.

**GET `/api/admin/dashboard/database-size` [Authorize]**
Executes raw SQL: `SELECT pg_size_pretty(pg_database_size(current_database()))`. Returns the human-readable database size string (e.g., `"8192 kB"`, `"3.7 MB"`). Uses the existing `DbConnection` directly — no ORM overhead needed for a scalar query. Useful for monitoring the free-tier database size limit.

### 5.5 Dashboard Activity Service

`DashboardActivityService` is a scoped service (new instance per request, except for the static `ConcurrentDictionary` fields) that handles:

- **Log writing** via `LogActivityAsync()`: Creates a new scope, gets `ApplicationDbContext`, adds a `SystemAuditLog` row, saves. Can be called fire-and-forget.
- **TOTP validation for deletion** via `VerifyTotpForDeletionAsync()`: Uses the same TOTP secret as the login TOTP but maintains a completely separate per-IP attempt counter with exponential backoff (unlike login's fixed 1-minute cooldown). On 3 consecutive failures, escalates to the shared `AdminBanRegistry` (24h ban, persisted to DB).
- **IP ban check** delegates to `AdminBanRegistry.IsBanned()` — the same shared registry used by login, pre-auth, and TOTP middleware. One ban covers all gates.

### 5.6 DashboardActivityMiddleware — Human-Readable Log Translation

`DashboardActivityMiddleware` intercepts every successful (2xx) API response and translates the raw `METHOD /path` into a human-readable description using `TranslateToDescription()`:

| Request | Logged description |
|---|---|
| `GET /api/products` | `"Someone is browsing the storefront main catalog"` |
| `GET /api/products/{id}` | `"Someone is viewing: Minimalist Leather Wallet"` (resolves name from RAM cache) |
| `POST /api/orders` | `"A customer placed a new order"` |
| `GET /api/orders/by-phone/*` | `"Someone is tracking an order"` |
| `POST /api/admin/products` | `"Admin created a new product"` |
| `GET /api/search?q=ring` | `"Someone searched for: 'ring'"` |
| Other `/api/admin/*` | `"Admin performed {METHOD} on {path}"` |

Product name resolution for `/api/products/{id}` reads directly from the in-memory `ProductCacheService` — zero DB queries.

### 5.7 Monitoring Ping Endpoint

```csharp
app.MapPost("/api/monitoring/ping", async (TelemetryPing ping, HttpContext context, IDashboardActivityService activityService) => {
    await activityService.LogActivityAsync(ip, forwardedFor, userAgent, $"{ping.Action}: {ping.Metadata}", AuditActionType.TelemetryPing);
    return Results.Accepted();
});
```

This is a minimal API endpoint (not a controller) accepting `{ action: string, metadata: string }` payloads from the Angular `TelemetryService`. Returns `202 Accepted` immediately.

### 5.8 Startup Seeding (Fully Idempotent)

On every startup (all checks prevent duplicate inserts):

1. `context.Database.MigrateAsync()` — applies any pending EF Core migrations
2. Raw SQL defensive column guard — ensures `ExternalImageUrl` and nullable `CategoryId` exist regardless of migration Designer.cs history
3. 6 default categories (slug-deduped)
4. 8 mock products with Unsplash images (slug-deduped)
5. Site content items — hero text, hero slideshow images, manifesto, feature sections (key-deduped)
6. Admin user — **only if `AdminUsers` table is empty** — the env var password is a first-boot seed, never an override
7. `IsTotpEnabled` row in `AdminSettings` — seeded as `"true"` only if the key doesn't exist yet

### 5.9 Product RAM Cache

All public product reads skip PostgreSQL entirely:

```
Startup → ProductCacheService.RefreshCacheAsync() → IMemoryCache (24h TTL)
Public GET /api/products → IMemoryCache → 0 DB queries
Admin write (create/edit/delete product) → DB → RefreshCacheAsync()
```

The cache is a singleton. `DashboardActivityMiddleware` also calls `productCache.GetById(id)` when translating product-specific log descriptions — this too is zero-DB.

---

## 6. Data Model & Database

### 6.1 Complete Entity List

| Entity | Key fields | Key behaviors |
|---|---|---|
| `Category` | Name, Slug (unique), IsActive | Products FK → SetNull on category delete |
| `Product` | Title, Slug (unique), Price, CategoryId? (nullable), SortOrder, IsActive | Cascade-deletes images; restricts delete if referenced by OrderItems |
| `ProductImage` | ProductId, ImageUrl, PublicId? (null for Unsplash), IsPrimary, SortOrder | Multi-image per product |
| `Order` | PublicOrderNumber (unique), CustomerName, Phone, Address, Status (string enum), PaymentStatus, PaymentMethod, Subtotal, ShippingFee, TotalAmount, TransactionId? | |
| `OrderItem` | OrderId, ProductId, **TitleSnapshot**, **PriceSnapshot**, Quantity | Price/title snapshotted — product edits never affect past orders |
| `OrderMessage` | OrderId, Sender (max 40), MessageText | Admin–customer thread per order |
| `Review` | ProductId, OrderId (composite unique), Rating (1–5), IsApproved | Schema ready; moderation UI pending |
| `AdminUser` | UserName (unique), PasswordHash (BCrypt), Role, DisplayName, IsActive, LastLoginAt | |
| `SiteContentItem` | ContentKey (unique), Kind (Text/Image), TextValue, **BinaryValue** (bytea), **ExternalImageUrl**, IsActive | Binary takes priority over ExternalImageUrl |
| `AdminAccessBan` | IpAddress (unique), FailedAttempts, BanUntilUtc, IsActive, Reason | Written async; warmed into memory on startup |
| `SystemAuditLog` | ActionType, ActionDate, **RemoteIpAddress**, **ForwardedFor**, **UserAgent**, **Description** | New fields added in migration #8 |
| `SocialLink` | Icon, Name (unique), Url, SortOrder, IsActive | Footer social links, CMS-managed |
| `PaymentDetail` | Key (unique), Value, SortOrder, IsActive | UPI ID / phone shown to customers |
| `AdminSetting` | Key (unique), Value | Key-value store for runtime config; `IsTotpEnabled` stored here |

**Bold** = field added after initial migration.

### 6.2 Base Entity

Every entity inherits `EntityBase`:
```csharp
public abstract class EntityBase {
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

UUIDs as PKs — eliminates the need for sequences, safe to generate client-side, no ID enumeration attacks.

### 6.3 Key Database Indexes

- `Categories.Slug` — unique
- `Products.Slug` — unique
- `ProductImages.(ProductId, SortOrder)` — composite
- `Orders.PublicOrderNumber` — unique
- `Orders.CustomerPhone` — for customer lookup
- `Reviews.(ProductId, OrderId)` — composite unique
- `AdminUsers.UserName` — unique
- `SiteContentItems.ContentKey` — unique
- `AdminAccessBans.IpAddress` — unique
- `SystemAuditLogs.(TableName, ActionType, ActionDate)` — composite for log queries
- `SocialLinks.Name` — unique
- `PaymentDetails.Key` — unique
- `AdminSettings.Key` — unique

### 6.4 Enum Storage Strategy

`OrderStatus` and `PaymentStatus` are stored as **strings** (`.HasConversion<string>()`), not integers. This makes the database rows human-readable and prevents silent data corruption if enum member order ever changes. All enums are also serialized as strings in JSON via `JsonStringEnumConverter`.

---

## 7. Security Architecture

### 7.1 Threat Model

Single-admin system. No customer logins. No stored payment credentials. Primary threat: unauthorized admin portal access. The security model is layered, not dependent on any single gate.

### 7.2 Full Admin Login Gate Chain

```
Incoming request to /api/admin/*
        │
        ▼
[Gate 0] DashboardActivityMiddleware
  — Runs post-response; logs the attempt regardless of outcome.
        │
        ▼
[Gate 1] AdminIpWhitelistMiddleware
  ├─ IP Ban check  → 403 Forbidden + ban expiry if banned
  ├─ Cooldown check → 429 Too Many Requests + seconds remaining
  └─ Pre-Auth Key check (for /preauth, /login, /verify-totp paths)
       Wrong key → 401 + increment counter
       5 wrong keys from same IP → 24h ban (memory write + async DB write)
       Progressive cooldowns: 0s → 0s → 3min → 8min → 15min
        │
        ▼
[Gate 2] TOTP Verification (POST /api/admin/verify-totp)
  — Skipped if IsTotpEnabled = false
  — Wrong code → 600ms delay + increment counter + 1min cooldown
  — 3 wrong codes → 24h ban (shared AdminBanRegistry)
        │
        ▼
[Gate 3] Username + BCrypt Password (POST /api/admin/login)
  — 400ms delay always
  — 600ms extra delay on failure
  — BCrypt.Verify() (timing-safe)
  — Success → HMAC-SHA256 signed JWT (8h expiry by default)
```

**Key property:** The IP ban registry (`AdminBanRegistry`) is shared across all gates — a ban from any gate blocks all subsequent gates. One shared `ConcurrentDictionary<string, DateTime>` covers pre-auth failures, TOTP login failures, dashboard TOTP failures, and any other brute-force gate.

### 7.3 TOTP Toggle Security

When the admin toggles TOTP via the Security panel:
- A confirmation phrase must be typed exactly: `"I, Admin wants to toggle it on/off"` (direction matches current state)
- A fresh valid TOTP code is required **even when turning TOTP off** — a stolen JWT alone cannot silently disable the security stage
- The new state is persisted to the `AdminSettings` table (survives server restarts)
- `IsTotpEnabled` defaults to `true` if the DB row doesn't exist (first run)

### 7.4 Dashboard Log Deletion Security

The `DELETE /api/admin/dashboard/activity` endpoint uses a separate security gate:
- Requires valid JWT (`[Authorize]`)
- Requires exact confirmation phrase
- Requires fresh TOTP code (separate counter from login TOTP)
- **Exponential cooldown** on wrong codes: 2min, 4min, 8min... (stronger than login's 1min fixed cooldown because log deletion is a more sensitive action)
- 3 wrong codes → 24h ban (same shared `AdminBanRegistry`)
- After deletion, logs the deletion event as a new entry (audit trail of the audit trail)

### 7.5 IP Ban System (Write-Behind Cache Pattern)

`AdminBanRegistry` is a static `ConcurrentDictionary<string, DateTime>` checked on every request:

1. **Hot path (incoming request):** Memory check, sub-millisecond
2. **On ban trigger:** Immediately write to memory (synchronous) → fire-and-forget async write to PostgreSQL
3. **On startup:** `WarmUpFromDatabaseAsync()` loads all active (non-expired) bans from DB back into memory — bans survive server restarts

### 7.6 Why IP Whitelisting Is Disabled (Documented Rationale)

The `AdminIpWhitelistMiddleware` contains full IP whitelisting code, commented out. This is a deliberate decision with explicit code comments:

- The admin has no corporate static IP, no VPN, no static residential IP
- Access from mobile networks, ISP DHCP, and multiple locations
- Free-tier reverse proxies make `X-Forwarded-For` trivially spoofable — whitelisting the forwarded IP would be security theater
- Pre-auth key + TOTP + BCrypt is sufficient for this threat model
- IP whitelisting in this environment would lock out the legitimate admin far more often than it would block attackers
- **The infrastructure is fully ready to re-enable it** when/if the deployment moves to a static-IP or VPN-gated environment

### 7.7 Planned: Admin Endpoint Path Obfuscation

**This is the next security priority, explicitly noted by the dev team.**

Currently `/api/admin` is a predictable path discoverable by automated scanners. The plan is to embed a random UUID segment in all admin routes (e.g., `/api/a3f7b91c-4d2e-4a1b-b3f0-9c8e7d6f5a4b/admin`) stored as an environment variable. This is purely additive security-through-obscurity on top of the existing multi-layer auth. Scanners that stumble on the path still face all the gates above; but most automated tools will never reach the first gate.

### 7.8 Rate Limiting

ASP.NET Core native `RateLimiter` with a fixed window policy `AdminLoginPolicy`: 5 requests per minute per client. Applied at the middleware level before controller routing.

### 7.9 CORS

Strict origin allowlist: `http://localhost:4200`, `https://localhost:4200`, and the production Vercel URL. `AllowCredentials()` for JWT cookie transport support.

### 7.10 JWT Configuration

- Algorithm: HMAC-SHA256
- Claims: `NameIdentifier` (admin GUID), `Name` (username), `Role` ("SuperAdmin")
- Default expiry: 480 minutes / 8 hours (configurable via env)
- Stored in `sessionStorage` (not cookies) — cleared on tab close
- Token is not stored in `localStorage` — survives refresh but not tab close (by design)

### 7.11 Password Requirements (Change Password — In Security Panel)

- Minimum 10 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
- New password cannot equal old password
- Old password must be provided and verified via BCrypt
- TOTP required even when login TOTP is disabled

### 7.12 Future Hardening

Not yet implemented but noted as needed:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- Basic `Content-Security-Policy`

---

## 8. Performance Techniques

### 8.1 Product RAM Cache — Zero DB Reads for Public Traffic

`ProductCacheService` (singleton) holds all active products + their images + categories in `IMemoryCache`. Public catalog reads (`GET /api/products`) issue zero SQL queries. Cache is invalidated and rebuilt on every admin product write. For a catalog of 8–500 products, the entire dataset fits within a few MB — the cost of zero DB latency is negligible.

### 8.2 Activity Log Translation Without DB Queries

`DashboardActivityMiddleware.TranslateToDescription()` resolves product names from the same in-memory `ProductCacheService`. When it logs `"Someone is viewing: Minimalist Leather Wallet"`, no SQL is executed — the product is looked up from RAM. This is significant because the middleware runs on every 2xx API response.

### 8.3 Fire-and-Forget Logging

All activity logging is non-blocking:
- `DashboardActivityMiddleware` fires `_ = activityService.LogActivityAsync(...)` (fire-and-forget)
- IP ban DB writes are `_ = Task.Run(async () => { ... })` (background task)
- The HTTP response is returned to the client before any of these writes complete
- Errors in logging are caught and swallowed so they never propagate to the caller

### 8.4 Cloudinary f_auto / q_auto

Product images served via Cloudinary get `/upload/f_auto,q_auto/` injected server-side into the URL. WebP served to supporting browsers (typically 25–35% smaller than JPEG), with optimal quality chosen by Cloudinary's CDN. Done server-side so every API response already has the optimized URL.

### 8.5 SSR First Contentful Paint

Angular SSR pre-renders the full page HTML. Visitors see the hero, product grid, and navigation before any JavaScript executes. Critical for mobile users on slower connections.

### 8.6 `AsNoTracking()` on All Read Queries

All admin and public read queries that don't need to write back use `.AsNoTracking()`. This skips EF Core's change-tracking overhead and reduces memory allocation per query.

### 8.7 `withFetch()` HTTP Client

`provideHttpClient(withFetch())` uses the native Fetch API instead of `XMLHttpRequest`. Required for SSR compatibility (Node.js `fetch` global) and generally faster than XHR.

### 8.8 Client-Side Product Search

All products are loaded into the browser's memory once on app boot. Search and category filtering run entirely in-browser with no round-trip. For a small catalog, this is faster than any server-side search endpoint.

---

## 9. Activity Monitoring & Telemetry System

This is one of the most distinctive features of the current version — a lightweight, zero-cost activity monitor that gives the admin visibility into real site traffic.

### 9.1 Data Collected Per Event

Every logged entry captures:
| Field | Source | Notes |
|---|---|---|
| `ActionDate` | Server UTC | When the event occurred |
| `RemoteIpAddress` | `HttpContext.Connection.RemoteIpAddress` | Real connection IP |
| `ForwardedFor` | `X-Forwarded-For` header | May be set by reverse proxy |
| `UserAgent` | `User-Agent` header | Browser/client identification |
| `Description` | `TranslateToDescription()` | Human-readable; e.g., "Someone is viewing: Soy Wax Candle Set" |
| `ActionType` | Enum | `DashboardActivity`, `TelemetryPing`, `DashboardDeletionAttempt`, `DashboardInvalidTotp` |

### 9.2 What Gets Logged

**From `DashboardActivityMiddleware` (backend):**
- Every successful (2xx) request to any `/api/*` endpoint
- Public browsing, order placement, order tracking
- All admin actions (product CRUD, category CRUD, order updates, content edits)

**From `POST /api/monitoring/ping` (telemetry endpoint):**
- Frontend-triggered events from `TelemetryService.trackUserAction()`
- Meant for events that don't produce a backend API call (e.g., cart interactions, page scrolls, UI clicks)

**From controller-level explicit logging:**
- `GET /api/admin/dashboard/activity` itself logs `"Admin fetched activity logs"`
- `DELETE /api/admin/dashboard/activity` logs `"Admin deleted N activity log entries"` after success
- Invalid TOTP attempts on deletion log `"Invalid TOTP attempt for dashboard deletion"`

### 9.3 Dashboard UI Features

The `AdminDashboardComponent` provides:
- **Fetch Activity Logs button:** Loads paginated logs (50/page), shows timestamp, IP, forwarded IP, user agent (truncated to 40 chars with full value in tooltip), and description
- **Database Size button:** Calls `GET /api/admin/dashboard/database-size` and displays the human-readable size (e.g., `"3.7 MB"`) — useful for monitoring against free-tier PostgreSQL limits
- **Checkbox selection:** Select individual rows or "Select All" on the current page
- **Delete flow (2-step):**
  1. Type the exact confirmation phrase
  2. Enter TOTP code
  3. Cooldown timer displayed if TOTP wrong (with `setInterval` countdown)
  4. On 403 (ban): auto-logout and redirect to `/admin/login`
- **Pagination:** Previous/Next for large log sets

### 9.4 AuditActionType Enum — Full List

```
Insert = 0, Update = 1, Delete = 2, Lockdown = 3, ElevatedPermissions = 4,
AutoRevoke = 5, CreateTable = 6, AlterTable = 7, DropTable = 8, TruncateTable = 9,
DashboardActivity = 10,        ← Regular API activity logs
TelemetryPing = 11,            ← Frontend telemetry pings
DashboardDeletionAttempt = 12, ← Successful or partial log deletions
DashboardInvalidTotp = 13      ← Wrong TOTP on deletion
```

---

## 10. External Integrations & Services

### 10.1 Cloudinary (Image CDN)

- **Free tier:** 25 credits/month (~25 000 transformations or 25 GB bandwidth)
- **Purpose:** Product image uploads, CDN delivery, format conversion
- **Upload flow:** Admin uploads → backend streams to Cloudinary → stores `SecureUrl` + `PublicId`
- **Upload transform:** Width capped at 2000px (`Transformation().Width(2000).Crop("limit")`)
- **Folder:** `products/` | **Upload preset:** `giftopia_preset`
- **Deletion:** Cloudinary `DestroyAsync(publicId)` called on product image delete — only for rows with a non-null `PublicId`
- **Runtime optimization:** `f_auto,q_auto` injected into URLs server-side

### 10.2 PostgreSQL

- **Local dev:** `Host=localhost;Port=5432;Database=giftshop;Username=postgres;Password=root`
- **Production:** `ConnectionStrings__DefaultConnection` env var
- **Compatible free hosts:** Neon (512 MB free), Supabase (500 MB free), Railway (1 GB free shared)
- **Schema:** `public`
- **DB size monitoring:** `GET /api/admin/dashboard/database-size` reports actual size via `pg_size_pretty(pg_database_size(current_database()))`

### 10.3 QuestPDF (Invoice Generation)

- **License:** Community (free, open source)
- **Purpose:** `GET /api/admin/orders/{id}/invoice` generates a PDF in memory and streams it
- **Content:** Store name, order number, date, status, customer info, line items table, subtotal/shipping/total, branded footer
- **No file storage:** Generated on demand, not stored

### 10.4 Vercel (Frontend Hosting)

- **Free Hobby tier:** 100 GB bandwidth/month, unlimited deployments
- **Static assets:** Served with `max-age: 1y` cache headers
- **SSR:** `server.mjs` runs as a Node.js serverless function

---

## 11. Admin Portal — Features & Status

### Authentication & Security

| Feature | Status | Notes |
|---|---|---|
| 3-stage login (Pre-auth → TOTP → Password) | ✅ Complete | |
| 2-stage login (Pre-auth → Password) | ✅ Complete | When TOTP disabled |
| Dynamic stage count on login page | ✅ Complete | Fetches `/api/admin/totp-status` on load |
| TOTP toggle via Security panel | ✅ Complete | Phrase + TOTP required; DB-persisted |
| Pre-auth key IP ban (24h) + exponential cooldowns | ✅ Complete | |
| TOTP login cooldown (1 min fixed) | ✅ Complete | |
| IP ban warm-up from DB on restart | ✅ Complete | |
| Password change (BCrypt, TOTP always required) | ✅ Complete | |
| Admin endpoint path obfuscation | ⏳ Next priority | Planned; not yet implemented |
| Security headers (CSP, X-Frame-Options, etc.) | ⏳ Planned | |

### Dashboard

| Feature | Status | Notes |
|---|---|---|
| Fetch activity logs (paginated, 50/page) | ✅ Complete | |
| Timestamp, IP, forwarded IP, user agent, description | ✅ Complete | |
| Database size button | ✅ Complete | Uses `pg_size_pretty` |
| Checkbox row selection | ✅ Complete | |
| Select all (current page) | ✅ Complete | |
| Delete selected logs (phrase + TOTP) | ✅ Complete | |
| Delete all logs | ✅ Complete | Pass `ids: null` |
| TOTP cooldown countdown in delete dialog | ✅ Complete | |
| Auto-logout on 24h IP ban during deletion | ✅ Complete | |
| Pagination (prev/next) | ✅ Complete | |
| Overview stats (orders, revenue counts) | ⏳ Planned | Not yet built |

### Products

| Feature | Status | Notes |
|---|---|---|
| List, create, edit, delete | ✅ Complete | |
| Cloudinary image upload (multi-image) | ✅ Complete | |
| Set primary image, reorder, delete images | ✅ Complete | |
| Toggle active/inactive | ✅ Complete | |
| RAM cache invalidation on write | ✅ Complete | |

### Categories

| Feature | Status | Notes |
|---|---|---|
| CRUD + toggle + product count | ✅ Complete | |

### Orders

| Feature | Status | Notes |
|---|---|---|
| List (paginated, filterable by status) | ✅ Complete | |
| Detail view (all fields, items, messages) | ✅ Complete | |
| Update order status (6 states) | ✅ Complete | |
| Update payment status + transaction ID | ✅ Complete | |
| Admin messages thread | ✅ Complete | |
| PDF invoice download (QuestPDF) | ✅ Complete | |
| Payment method field (UPI / Online) | ✅ Complete | |

### Homepage CMS

| Feature | Status | Notes |
|---|---|---|
| Edit hero heading, subheading, copy | ✅ Complete | |
| Hero slideshow image upload/replace | ✅ Complete | Stored as binary in PostgreSQL |
| Manifesto quote edit | ✅ Complete | |
| Feature section text + images | ✅ Complete | |

### Social Links & Payment Details

| Feature | Status | Notes |
|---|---|---|
| CRUD, reorder, toggle for both | ✅ Complete | Displayed in storefront footer |

### Invoices

| Feature | Status | Notes |
|---|---|---|
| List orders + download PDF | ✅ Complete | |

### WIP Pages (Placeholder/Coming Soon)

| Page | Status |
|---|---|
| Analytics | 🚧 Placeholder |
| Reviews moderation | 🚧 Schema exists; UI not built |
| Order tracking integration | 🚧 Placeholder |
| Automation (email alerts, etc.) | 🚧 Placeholder |
| General settings | 🚧 Placeholder |
| Media library | 🚧 Placeholder |

---

## 12. Public Storefront — Features & Status

| Feature | Status | Notes |
|---|---|---|
| Hero section (slideshow + heading + CTA) | ✅ Complete | CMS-driven from DB |
| Manifesto / philosophy section | ✅ Complete | CMS-driven |
| Product catalog grid | ✅ Complete | From RAM cache |
| Feature sections 1 & 2 | ✅ Complete | CMS-driven text + images |
| Highlight cards (gifting USPs) | ✅ Complete | Hardcoded defaults + CMS override |
| Navbar (logo, cart icon, search, track order) | ✅ Complete | |
| Cart drawer (add/remove/quantity) | ✅ Complete | In-memory only; no persistence |
| Product detail drawer (full description, images) | ✅ Complete | |
| Track Order modal (lookup by phone) | ✅ Complete | |
| Footer (social links, payment info) | ✅ Complete | CMS-driven |
| Checkout form (name, phone, address, payment method) | ✅ Complete | |
| Order placement (`POST /api/orders`) | ✅ Complete | |
| Order confirmation with order number | ✅ Complete | |

**What is intentionally absent from the storefront:**
- Customer login / accounts
- Payment gateway integration (payment is manual; admin verifies UPI proof)
- Real-time stock/inventory
- Email notifications
- Server-side search (all filtering is client-side in browser memory)

---

## 13. Cost Architecture

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel (frontend + SSR) | Free Hobby | ₹0 |
| Railway / Render / Neon (backend + DB) | Free tier | ₹0 |
| Cloudinary (image CDN) | Free (25 credits/month) | ₹0 |
| QuestPDF | Community License | ₹0 |
| Otp.NET, BCrypt.Net, Angular, ASP.NET | Open source / MIT | ₹0 |
| **Domain name** | Annual renewal | ~₹700–1500/yr |
| **Total recurring** | | **~₹0/month** |

**First cost to appear as traffic scales:** Cloudinary paid tier kicks in if monthly bandwidth exceeds 25 GB or transformations exceed 25,000 (paid tier starts ~$89/month). For a small startup this is unlikely for months or years.

**Free-tier hosting cold start note:** Render and Railway free tiers spin down after inactivity (~30 min). First request after spin-down can take 10–30 seconds. Mitigation options: upgrade to paid, use an external uptime monitor (UptimeRobot free tier) to ping `/isrunning` every 5 minutes, or use Railway's always-on free tier.

---

## 14. Migration History

| # | Migration name | Date | Schema change |
|---|---|---|---|
| 1 | `InitialCreate` | 2026-06-04 | Full initial schema: all core tables |
| 2 | `MakeCategoryIdNullable` | 2026-06-08 | `Products.CategoryId` → nullable |
| 3 | `AddExternalImageUrl` | 2026-06-08 | `SiteContentItems.ExternalImageUrl` column |
| 4 | `AddOrderTransactionId` | 2026-06-12 | `Orders.TransactionId` column |
| 5 | `AddOrderPaymentMethod` | 2026-06-12 | `Orders.PaymentMethod` enum column |
| 6 | `AddSocialAndPaymentDetails` | 2026-06-13 | `SocialLinks` + `PaymentDetails` tables |
| 7 | `AddAdminSettingsTable` | 2026-06-17 | `AdminSettings` table (key-value config store) |
| 8 | `AddDashboardActivityFieldsInSystemAuditLog` | 2026-06-18 | `SystemAuditLogs`: adds `RemoteIpAddress`, `ForwardedFor`, `UserAgent`, `Description` |

A defensive raw SQL guard runs every startup to ensure `ExternalImageUrl` and nullable `CategoryId` are present even if a migration's Designer.cs was missing in a prior run.

---

## 15. Environment Variables Reference

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `ConnectionStrings__DefaultConnection` | `Host=...;Port=5432;Database=giftshop;...` | Production | Falls back to localhost:5432 in dev |
| `AdminSettings__SecretPreAuthKey` | `MySecret16CharK` | Yes | Pre-auth key for admin portal |
| `AdminSettings__TotpSecret` | `JBSWY3DPEHPK3PXP` | Yes | Base32 TOTP secret (scan into authenticator app) |
| `AdminSettings__AdminUserName` | `admin` | First boot only | Only used when seeding initial admin user |
| `AdminSettings__AdminPassword` | `admin@2026` | First boot only | Only used when seeding initial admin user |
| `JwtSettings__SecretKey` | 32+ char random string | Yes | JWT signing key |
| `JwtSettings__Issuer` | `GiftShop.Api` | Optional | Default: `GiftShop.Api` |
| `JwtSettings__Audience` | `GiftShop.Admin` | Optional | Default: `GiftShop.Admin` |
| `JwtSettings__ExpiryMinutes` | `480` | Optional | Default: 480 (8 hours) |
| `CloudinarySettings__CloudName` | `dxxxxx` | Yes (images) | Cloudinary account cloud name |
| `CloudinarySettings__ApiKey` | `123456789` | Yes (images) | Cloudinary API key |
| `CloudinarySettings__ApiSecret` | `xxxxxxxxxxx` | Yes (images) | Cloudinary API secret |

---

## 16. Known Gaps, Planned Work & Next Steps

### 16.1 Admin Endpoint Path Obfuscation (Immediate Priority)

The `/api/admin` prefix is predictable. The plan: add a random UUID segment to all admin routes (e.g., `/api/a3f7b91c-.../admin`), stored as an environment variable and injected at startup as the route prefix. This prevents automated scanners from even discovering the admin surface. It is additive obscurity on top of existing auth — not a replacement for any layer.

### 16.2 Security Headers Middleware

A single middleware pass to add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and a basic `Content-Security-Policy`. Low effort, meaningful improvement.

### 16.3 Email Notifications

No outbound emails exist. The admin must check the portal manually for new orders. A free-tier integration (Resend free: 3000/month; Brevo free: 300/day) would send an order summary email to the admin on new order placement. High impact for daily operations.

### 16.4 Reviews Moderation

`Review` entity, database schema, and all FK relationships exist and are production-ready. The admin reviews page and public review display are not yet built. This is structurally near-complete — the backend work is minimal.

### 16.5 Audit Log Wiring for Admin Writes

`SystemAuditLog` has `OldValue`, `NewValue`, `TableName`, and `UserName` fields specifically for admin CRUD audit trails. Currently these are not populated by any controller. A future pass should log product/order/category changes with before/after snapshots for accountability.

### 16.6 TOTP Setup UX

The TOTP secret is currently set via environment variable and manually scanned into the authenticator app as a Base32 string. A one-time setup wizard with QR code generation would improve initial admin onboarding significantly.

### 16.7 Inventory / Stock Management

No stock count exists. All products appear available regardless of sales. For a small handmade goods shop, the admin knows stock personally. If needed: add `StockQuantity` field to `Product`, decrement on order placement, add low-stock admin alert.

### 16.8 Customer-Facing Order Updates

Currently the only way customers know their order status has changed is by re-checking the track order modal. WhatsApp message templates or SMS via a free tier would dramatically improve customer experience.

### 16.9 SSR Admin Route Exclusion

Admin routes make API calls to `localhost:5000` which is unreachable from Vercel's SSR Node environment. The current fix (`withNoHttpTransferCache()`) prevents SSR from intercepting these calls. A cleaner long-term solution is to mark admin routes with `renderMode: RenderMode.Client` to skip SSR entirely for admin pages.

### 16.10 Activity Log Growth Management

`SystemAuditLogs` grows indefinitely (every API request adds a row). The current admin delete UI is the only cleanup mechanism. Future improvements: automatic purge of logs older than N days via a scheduled job, or a pg_cron trigger, to keep the free-tier DB within size limits.

---

## 17. Developer Notes & Gotchas

**1. Password seeding is gated on `!AnyAsync()`.**
The admin user seed fires only when `AdminUsers` is empty. The env var `AdminSettings__AdminPassword` is a first-boot seed, not an override. Changing the password via the Security panel writes a new BCrypt hash directly to the database — server restarts do not revert it.

**2. `IsTotpEnabled` is stored in PostgreSQL, not appsettings.**
An earlier design had this written back to `appsettings.json` on disk (common pattern but fragile on containerized hosts). The current design stores it in the `AdminSettings` table. It's read from DB on every login and TOTP-related endpoint. No server restart is needed after a toggle.

**3. `withNoHttpTransferCache()` in Angular app config.**
Without this, Angular SSR's HTTP state transfer caches admin API responses from server rendering time. Since `localhost:5000` is unreachable from Vercel's Node runtime, these cached responses are empty/errored. The browser never re-fetches. This flag disables transfer caching for all HTTP calls — always keep it.

**4. `UseWhen` vs `app.Map` for conditional middleware.**
`app.Map("/api/admin", branch => { branch.UseMiddleware<>(); branch.Run(...) })` creates a terminal branch. Requests match the prefix, run the middleware, hit `.Run()`, and never reach `MapControllers()`. `app.UseWhen(predicate, b => b.UseMiddleware<>())` is conditional and non-terminal — the main pipeline continues after the middleware passes.

**5. EF Core 10.0.5 + Npgsql `Contains` bug.**
`req.Ids.Contains(l.Id)` in a LINQ-to-SQL query triggers an `SqlNullabilityProcessor` error in this version combination. Workaround: load all rows into memory with `.ToListAsync()` and filter with C# `List.Contains()`. Documented in `AdminDashboardController.cs`. Safe because the activity table is small.

**6. Cloudinary `PublicId` is null for seeded images.**
Seeded mock products use Unsplash URLs with `PublicId = null`. The delete flow skips Cloudinary deletion when `PublicId` is null. Never assume all `ProductImage` rows have a Cloudinary ID.

**7. TOTP window is ±1 step (90-second total tolerance).**
`new VerificationWindow(1, 1)` accepts previous, current, and next 30-second windows. Standard TOTP practice for clock drift and network lag tolerance.

**8. `SiteContentItem.BinaryValue` is PostgreSQL `bytea`.**
Section images (hero slideshow, feature images) uploaded by the admin are stored directly as binary in the database — no Cloudinary credits consumed for non-product images. `ExternalImageUrl` provides the seeded default. Binary takes priority when present. For ~10 section images, this is entirely acceptable.

**9. `TelemetryService` uses `keepalive: true`.**
The `keepalive` flag on the `fetch` call to `/api/monitoring/ping` ensures the request completes even if the user navigates away mid-flight. Errors are silently caught — telemetry must never break the UI.

**10. Order price snapshotting.**
`OrderItem.TitleSnapshot` and `PriceSnapshot` are copied at order creation time. Editing a product's price or title afterwards does not affect existing orders. This is correct e-commerce behavior and is intentional.

**11. Defensive raw SQL guard on startup.**
Some early migrations were applied without their `Designer.cs` companion files. EF Core records the migration in `__EFMigrationsHistory` but doesn't run the SQL without the Designer. The raw SQL guard in `Program.cs` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) bridges this gap idempotently on every startup.

**12. DashboardActivityMiddleware fires after response.**
`await _next(context)` is called first; logging happens after. Only 2xx responses are logged. Logging is fire-and-forget — a DB write failure never delays or errors the HTTP response.
