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
```

- Each file in `pages/` is a standalone Angular component (simple WIP placeholders) imported into the app routes; they render inside the `AdminShellComponent` router outlet.

## Notes on the `sessionStorage` error and the SSR cause
- Symptom: dev server logged `ERROR ReferenceError: sessionStorage is not defined` and the admin routes returned `Cannot GET /admin/login`.
- Why it happened: the `AdminAuthService` attempted to read `sessionStorage` during service construction. The Angular dev server runs initial application code on the server (SSR) to generate server bundles; server-side Node does not have browser globals like `window`, `localStorage`, or `sessionStorage`, so accessing them throws a ReferenceError.
- How we diagnosed it: the stack trace pointed to `AdminAuthService.restoreSession` (file and function), making it clear the missing global was accessed during early app init. The server bundle output (main.server.mjs / server.mjs) confirmed SSR was active.
- Fix applied: guard storage calls with an Angular platform check. In `src/app/admin/services/admin-auth.service.ts` we used:

	- inject `PLATFORM_ID` and call `isPlatformBrowser(PLATFORM_ID)`
	- only access `sessionStorage` / `localStorage` when `isPlatformBrowser(...)` is true

This prevents the service from touching browser-only APIs when code runs on the server, eliminating the ReferenceError and allowing the `/admin/login` route to load in the browser.


## June 02, 2026 — Order Bag persistence (search, findings, implementation, reasoning)

- What I searched: I searched the frontend codebase for any references to the Order Bag / cart and for browser persistence APIs. Specifically I looked for `orderbag`, `cart`, `cart-drawer.component.ts`, `AppStateService`, and browser storage usages: `localStorage`, `sessionStorage`, `indexedDB`, `getItem`, `setItem`.

- What I found: The cart UI is implemented in `src/app/components/cart-drawer.component.ts` and the application state is managed by `src/app/services/app-state.service.ts` using an in-memory `BehaviorSubject<CartItem[]>`. There were no `localStorage`/`sessionStorage` usage for the cart (only the admin auth used `sessionStorage` guarded for platform). In short: the cart lived only in volatile memory and would be lost on page refresh or when the tab was closed.

`The key difference is persitence among BehaviorSubject vs localStorage vs sessionStorage`

BehaviorSubject in memory: survives component changes and service reuse during the current app session, but disappears on refresh, tab close, or full reload.
localStorage: persists across reloads, tab closes, and browser restarts until you clear it. It is tied to the browser profile.
sessionStorage: persists across reloads in the same tab, but is cleared when that tab closes. It is also tied to the browser profile, but narrower than localStorage.
- Problem: Because the cart was kept only inside a `BehaviorSubject`(A BehaviorSubject is just an in-memory state container from RxJS.) in memory, a user who refreshes or closes the tab loses their curated selection. This breaks a typical shopping flow where users may browse, pause, and come back later to complete the purchase.

So the usual pattern is: BehaviorSubject holds the live cart state, and localStorage or sessionStorage stores a copy so the cart can be restored later. 

- What I implemented: I updated `src/app/services/app-state.service.ts` to persist the cart to browser `localStorage` in a platform-safe way.
	- Added a storage key: `__order_bag`.
	- Injected `PLATFORM_ID` and used `isPlatformBrowser(...)` to guard all browser API access so SSR/server-side code never attempts to read/write browser storage.
	- On service construction, the cart is seeded from `localStorage` when running in the browser.
	- On every cart mutation (`addToCart`, `removeFromCart`, `clearCart`) the cart is serialized and saved to `localStorage` (or removed when cleared).
	- Creating an order still clears the in-memory cart and removes the persisted key.

- Why `localStorage` (design reasoning):
	- Shopping is not always instantaneous; users often curate over time. `localStorage` preserves the bag across reloads and across new tabs in the same browser profile, which is the desired behavior for an accountless, low-friction store.
	- `sessionStorage` would clear the cart when the tab is closed, which would frustrate users who intentionally close a tab to think and return later.

- Privacy note (decision):
	- The implementation keeps the cart tied to the browser profile (standard behavior across the web). While two people sharing a browser profile would see the same bag, adding server-side sessions or sign-in requirements would violate the project's constraint of keeping the store accountless and lightweight. Given the product needs (gift selection persisted across reloads) `localStorage` is the right trade-off.

- Files modified:
	- `src/app/services/app-state.service.ts` — added platform checks and `localStorage` persistence and removal on clear.

- Follow-ups you might want:
	- If you prefer per-tab isolation instead, switch to `sessionStorage` (I can change it).
	- If you'd like automatic migration or expiration of stale carts, I can add a timestamp and TTL logic.

Entry date: 2 June, 2026


