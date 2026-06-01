import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="gs-navbar">
      <div class="gs-container">
        <button class="brand" type="button" (click)="scrollTo('hero')">
          <img src="/assets/Artistry-Giftopia-300x300.png" alt="Kalakaari Gifting" class="logo" />
          <span>
            <span class="brand-name">Kalakaari Gifting</span>
            <span class="brand-tagline">Handmade with Love</span>
          </span>
        </button>
        <nav class="actions">
          <button class="track" type="button" (click)="openTrack()">📦 Track Order</button>
          <button class="track" type="button" (click)="scrollTo('catalog')">Browse Catalog</button>
          <button class="cta" type="button" (click)="openCart()">
            🛍️ Order Bag
            <span class="badge" *ngIf="cartCount > 0">{{ cartCount }}</span>
          </button>
        </nav>
      </div>
    </header>
  `,
  styles: [
    `:host{display:block}
    .gs-navbar{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,0.78);backdrop-filter:blur(14px);border-bottom:1px solid rgba(209,209,209,0.5);transition:var(--transition)}
    .gs-container{max-width:1240px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;min-height:72px;padding:0 2rem;gap:1rem}
    .brand{display:flex;align-items:center;gap:0.75rem;background:none;border:0;padding:0;text-align:left}
    .logo{width:46px;height:46px;border-radius:10px;object-fit:cover;box-shadow:0 2px 8px rgba(136,173,53,0.2)}
    .brand-name{display:block;font-family:var(--font-display);font-size:1.2rem;font-weight:600;color:var(--color-charcoal);letter-spacing:-0.02em;line-height:1.2}
    .brand-tagline{display:block;font-size:0.72rem;color:var(--color-primary);font-weight:500;letter-spacing:0.04em}
    .actions{display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;justify-content:flex-end}
    .actions button{border:0;cursor:pointer;transition:var(--transition);font-family:var(--font-ui)}
    .track{background:transparent;border:1.5px solid var(--color-border);color:var(--color-charcoal);padding:0.5rem 1.1rem;border-radius:50px;font-size:0.875rem;font-weight:500}
    .track:hover{border-color:var(--color-primary);color:var(--color-primary)}
    .cta{position:relative;background:var(--color-primary);color:#fff;padding:0.55rem 1.3rem;border-radius:50px;font-size:0.875rem;font-weight:600;box-shadow:0 2px 12px rgba(136,173,53,0.35)}
    .cta:hover{background:var(--color-primary-d);box-shadow:0 4px 16px rgba(136,173,53,0.45)}
    .badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:0.4rem;border-radius:999px;background:#fff;color:var(--color-primary-d);font-size:0.65rem;font-weight:700}
    @media (max-width:700px){.gs-container{padding:0 1.25rem;flex-direction:column;align-items:flex-start}.actions{justify-content:flex-start}}
    `
  ]
})
export class NavbarComponent {
  cartCount = 0;

  constructor(private state: AppStateService) {
    this.state.cart$.subscribe((items) => {
      this.cartCount = items.reduce((count, item) => count + item.quantity, 0);
    });
  }

  openTrack() { this.state.showTrackModal(); }
  openCart() { this.state.openCart(); }

  scrollTo(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }
}
