import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AppStateService, ProductItem } from '../services/app-state.service';

@Component({
  selector: 'app-product-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drawer-overlay" [class.active]="!!product" (click)="close()"></div>
    <aside class="drawer" [class.open]="!!product" aria-hidden="{{ !product }}">
      <div class="drawer-close">
        <span>Product Details</span>
        <button class="drawer-close-btn" (click)="close()" type="button">✕</button>
      </div>
      <img class="drawer-img-main" [src]="product?.image" [alt]="product?.title || 'Selected product'" />
      <div class="drawer-body" *ngIf="product as selectedProduct">
        <div class="drawer-category">{{ selectedProduct.category }}</div>
        <div class="drawer-title">{{ selectedProduct.title }}</div>
        <div class="drawer-price">{{ selectedProduct.price }}</div>
        <div class="drawer-desc">{{ selectedProduct.description }}</div>
        <div class="drawer-qty-row">
          <span class="drawer-qty-label">Quantity</span>
          <div class="qty-control">
            <button class="qty-btn" type="button" (click)="changeQty(-1)">−</button>
            <span class="qty-value">{{ quantity }}</span>
            <button class="qty-btn" type="button" (click)="changeQty(1)">+</button>
          </div>
        </div>
        <button type="button" class="btn-add-to-cart" (click)="addToCart()">🛍️ Add to Order Bag</button>
      </div>
    </aside>
  `,
  styles: [
    `:host{position:fixed;inset:0;pointer-events:none;z-index:900}
    .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity 0.3s}
    .drawer-overlay.active{opacity:1;pointer-events:auto}
    .drawer{position:fixed;right:0;top:0;height:100vh;width:min(560px,100vw);background:#fff;overflow-y:auto;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.25,0.8,0.25,1);box-shadow:-12px 0 48px rgba(34,34,34,0.15);pointer-events:auto}
    .drawer.open{transform:translateX(0)}
    .drawer-close{position:sticky;top:0;background:#fff;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(209,209,209,0.4)}
    .drawer-close span{font-size:0.8rem;font-weight:600;color:var(--color-body);letter-spacing:0.06em;text-transform:uppercase}
    .drawer-close-btn{background:var(--color-bg);border:none;width:36px;height:36px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .drawer-close-btn:hover{background:var(--color-border)}
    .drawer-img-main{width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--color-sage)}
    .drawer-body{padding:1.75rem 1.5rem}
    .drawer-category{font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-primary);margin-bottom:0.5rem}
    .drawer-title{font-family:var(--font-display);font-size:1.7rem;font-weight:700;color:var(--color-charcoal);line-height:1.2;margin-bottom:0.75rem}
    .drawer-price{font-family:var(--font-ui);font-size:1.5rem;font-weight:700;color:var(--color-primary);margin-bottom:1.25rem}
    .drawer-desc{font-size:0.98rem;color:var(--color-body);line-height:1.75;border-top:1px solid rgba(209,209,209,0.4);padding-top:1.25rem;margin-bottom:1.5rem}
    .drawer-qty-row{display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem}
    .drawer-qty-label{font-size:0.875rem;font-weight:500;color:var(--color-charcoal)}
    .qty-control{display:flex;align-items:center;gap:0.5rem}
    .qty-btn{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--color-border);background:transparent;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .qty-btn:hover{border-color:var(--color-primary);color:var(--color-primary)}
    .qty-value{font-weight:600;font-size:1rem;min-width:24px;text-align:center}
    .btn-add-to-cart{width:100%;padding:1rem;background:var(--color-primary);color:#fff;border:none;border-radius:50px;font-size:1rem;font-weight:600;transition:var(--transition);box-shadow:0 4px 16px rgba(136,173,53,0.4)}
    .btn-add-to-cart:hover{background:var(--color-primary-d);transform:translateY(-2px);box-shadow:0 8px 24px rgba(136,173,53,0.45)}
    `
  ]
})
export class ProductDetailDrawerComponent {
  product: ProductItem | null = null;
  quantity = 1;

  constructor(private state: AppStateService) {
    this.state.selectedProduct$.subscribe((product) => {
      this.product = product;
      this.quantity = 1;
    });
  }

  close() { this.state.closeProduct(); }
  changeQty(delta: number) { this.quantity = Math.max(1, this.quantity + delta); }
  addToCart() { if (this.product) { this.state.addToCart(this.product, this.quantity); this.close(); } }
}
