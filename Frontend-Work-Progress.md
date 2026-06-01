# Work log

## May 31, 2026
I created the frontend project with the help of

```
ng new Gift-Shop
```

And then created an asset folder in the `src` using `mkdir assets`.

## June 01, 2026 — Admin shell & pages added
- Added admin area under `src/app/admin/` with this structure:

```
src/app/admin/
	├── services/
	│   └── admin-auth.service.ts       (JWT/session management; platform-guarded storage)
	├── guards/
	│   └── admin.auth.guard.ts         (Route protection, redirects to `/admin/login`)
	├── components/
	│   ├── admin-shell.component.ts    (Main layout: sidebar + topbar)
	│   ├── admin-login.component.ts    (Login page)
	│   └── admin-ui.component.ts       (Reusable UI: stat, section, badge, WIP modal, button)
	└── pages/
			├── admin-dashboard.component.ts
			├── admin-analytics.component.ts
			├── admin-products.component.ts
			├── admin-categories.component.ts
			├── admin-media.component.ts
			├── admin-homepage.component.ts
			├── admin-reviews.component.ts
			├── admin-orders.component.ts
			├── admin-payments.component.ts
			├── admin-invoices.component.ts
			├── admin-tracking.component.ts
			├── admin-automation.component.ts
			├── admin-settings.component.ts
			└── admin-security.component.ts

- Each file in `pages/` is a standalone Angular component (simple WIP placeholders) imported into the app routes; they render inside the `AdminShellComponent` router outlet.

## Notes on the `sessionStorage` error and the SSR cause
- Symptom: dev server logged `ERROR ReferenceError: sessionStorage is not defined` and the admin routes returned `Cannot GET /admin/login`.
- Why it happened: the `AdminAuthService` attempted to read `sessionStorage` during service construction. The Angular dev server runs initial application code on the server (SSR) to generate server bundles; server-side Node does not have browser globals like `window`, `localStorage`, or `sessionStorage`, so accessing them throws a ReferenceError.
- How we diagnosed it: the stack trace pointed to `AdminAuthService.restoreSession` (file and function), making it clear the missing global was accessed during early app init. The server bundle output (main.server.mjs / server.mjs) confirmed SSR was active.
- Fix applied: guard storage calls with an Angular platform check. In `src/app/admin/services/admin-auth.service.ts` we used:

	- inject `PLATFORM_ID` and call `isPlatformBrowser(PLATFORM_ID)`
	- only access `sessionStorage` / `localStorage` when `isPlatformBrowser(...)` is true

This prevents the service from touching browser-only APIs when code runs on the server, eliminating the ReferenceError and allowing the `/admin/login` route to load in the browser.


