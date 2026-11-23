import { computed, inject, Injectable, signal } from '@angular/core';
import { AdminApiService } from './admin-api.services';

// ── LocalStorage key used to persist which orders the admin has acknowledged ──
export const SEEN_ORDERS_KEY = 'adm_seen_order_ids';

export function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ORDERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function saveSeenIds(ids: Set<string>) {
  try { localStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify([...ids])); } catch {}
}

/**
 * Shared singleton that tracks "unseen" order count for the sidebar badge.
 *
 * Both AdminShellComponent (sidebar badge) and AdminOrdersComponent (orders
 * table) inject this same instance, so:
 *  - marking an order as seen (✓ button, opening details, "mark all seen")
 *    updates the badge INSTANTLY in the same render — no logout/relogin needed.
 *  - calling refresh() (e.g. from the Orders page's "↻ Refresh" button, or on
 *    sidebar open) re-fetches the order list so newly-placed orders are
 *    reflected in the badge count right away.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrdersStateService {
  private api = inject(AdminApiService);

  /** IDs of all orders currently known (first 100, newest-first from API). */
  private allOrderIds = signal<string[]>([]);

  /** IDs the admin has explicitly acknowledged — persisted to localStorage. */
  private seenIds = signal<Set<string>>(getSeenIds());

  /** Live count of orders not yet marked seen. */
  unseenCount = computed(() => {
    const seen = this.seenIds();
    return this.allOrderIds().filter(id => !seen.has(id)).length;
  });

  constructor() {
    this.refresh();

    // Cross-tab sync: if the admin has the portal open in two tabs,
    // a seen-state change in one tab updates the badge in the other.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === SEEN_ORDERS_KEY) {
          this.seenIds.set(getSeenIds());
        }
      });
    }
  }

  /** Re-fetches the order list so new orders are picked up for the badge. */
  refresh() {
    this.api.getOrders(1, 100).subscribe({
      next: (res) => this.allOrderIds.set(res.items.map(o => o.id)),
      error: () => {}
    });
  }

  isUnseen(id: string): boolean {
    return !this.seenIds().has(id);
  }

  markSeen(id: string) {
    if (!this.seenIds().has(id)) {
      const updated = new Set(this.seenIds());
      updated.add(id);
      saveSeenIds(updated);
      this.seenIds.set(updated);
    }
  }

  markAllSeen(ids: string[]) {
    const updated = new Set(this.seenIds());
    ids.forEach(id => updated.add(id));
    saveSeenIds(updated);
    this.seenIds.set(updated);
  }
}