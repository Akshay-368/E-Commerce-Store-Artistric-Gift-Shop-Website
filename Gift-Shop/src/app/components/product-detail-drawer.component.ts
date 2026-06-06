import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AppStateService, ProductImage, ProductItem } from '../services/app-state.service';

@Component({
  selector: 'app-product-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drawer-overlay" [class.active]="!!product" (click)="close()"></div>
    <aside class="drawer" [class.open]="!!product" [attr.aria-hidden]="!product">
      <div class="drawer-close">
        <span>Product Details</span>
        <button class="drawer-close-btn" (click)="close()" type="button" aria-label="Close">✕</button>
      </div>

      <!-- ── Image Gallery ──────────────────────────────────────────── -->
      <div class="gallery-wrap" *ngIf="product">
        <!-- Main display image -->
        <div class="gallery-main">
          <img
            [src]="activeImage"
            [alt]="product.title"
            class="gallery-main-img"
          />
          <!-- Arrow navigation for multiple images -->
          <button
            *ngIf="hasMultipleImages"
            class="gallery-arrow left"
            (click)="prevImage()"
            type="button"
            aria-label="Previous image">‹</button>
          <button
            *ngIf="hasMultipleImages"
            class="gallery-arrow right"
            (click)="nextImage()"
            type="button"
            aria-label="Next image">›</button>
        </div>

        <!-- Thumbnail strip for multiple images -->
        <div class="gallery-thumbs" *ngIf="hasMultipleImages">
          <button
            *ngFor="let img of allImages; let i = index"
            class="thumb-btn"
            [class.active]="i === activeImageIndex"
            (click)="goToImage(i)"
            type="button"
            [attr.aria-label]="'View image ' + (i + 1)">
            <img [src]="img.optimizedUrl || img.imageUrl" [alt]="img.altText || product.title" />
          </button>
        </div>

        <!-- Dot indicators (for mobile / when thumbs are hidden) -->
        <div class="gallery-dots" *ngIf="hasMultipleImages">
          <span
            *ngFor="let img of allImages; let i = index"
            class="dot"
            [class.active]="i === activeImageIndex"
            (click)="goToImage(i)">
          </span>
        </div>
      </div>

      <!-- ── Product Info ────────────────────────────────────────────── -->
      <div class="drawer-body" *ngIf="product as p">
        <div class="drawer-category">{{ p.category }}</div>
        <div class="drawer-title">{{ p.title }}</div>
        <div class="drawer-price">{{ p.price }}</div>
        <div class="drawer-desc">{{ p.description }}</div>
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
  styles: [`
    :host{position:fixed;inset:0;pointer-events:none;z-index:900}
    .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity 0.3s}
    .drawer-overlay.active{opacity:1;pointer-events:auto}
    .drawer{position:fixed;right:0;top:0;height:100vh;width:min(600px,100vw);background:#fff;overflow-y:auto;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.25,0.8,0.25,1);box-shadow:-12px 0 48px rgba(34,34,34,0.15);pointer-events:auto}
    .drawer.open{transform:translateX(0)}
    .drawer-close{position:sticky;top:0;background:#fff;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(209,209,209,0.4)}
    .drawer-close span{font-size:0.8rem;font-weight:600;color:var(--color-body);letter-spacing:0.06em;text-transform:uppercase}
    .drawer-close-btn{background:var(--color-bg);border:none;width:36px;height:36px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .drawer-close-btn:hover{background:var(--color-border)}

    /* ── Gallery ──────────────────────────────────────────────────── */
    .gallery-wrap{background:#000}
    .gallery-main{position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--color-sage)}
    .gallery-main-img{width:100%;height:100%;object-fit:cover;transition:opacity 0.3s}
    .gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.45);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:1.6rem;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;transition:var(--transition);backdrop-filter:blur(4px)}
    .gallery-arrow:hover{background:rgba(0,0,0,0.7)}
    .gallery-arrow.left{left:0.75rem}
    .gallery-arrow.right{right:0.75rem}
    .gallery-thumbs{display:flex;gap:0.5rem;padding:0.75rem;background:#f5f5f5;overflow-x:auto;scrollbar-width:thin}
    .thumb-btn{flex-shrink:0;width:60px;height:60px;border-radius:8px;overflow:hidden;border:2px solid transparent;background:transparent;cursor:pointer;padding:0;transition:var(--transition)}
    .thumb-btn.active{border-color:var(--color-primary)}
    .thumb-btn img{width:100%;height:100%;object-fit:cover}
    .gallery-dots{display:flex;justify-content:center;gap:6px;padding:0.6rem 0;background:#f5f5f5}
    .gallery-dots .dot{width:8px;height:8px;border-radius:50%;background:rgba(34,34,34,0.25);cursor:pointer;transition:all 0.2s}
    .gallery-dots .dot.active{background:var(--color-primary);transform:scale(1.25)}

    /* ── Product info ───────────────────────────────────────────────── */
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
  `]
})
export class ProductDetailDrawerComponent {
  product: ProductItem | null = null;
  quantity = 1;
  activeImageIndex = 0;

  constructor(private state: AppStateService) {
    this.state.selectedProduct$.subscribe(p => {
      this.product = p;
      this.quantity = 1;
      this.activeImageIndex = 0;
    });
  }

  get allImages(): ProductImage[] {
    if (!this.product) return [];
    const imgs = this.product.images ?? [];
    if (imgs.length === 0 && this.product.image) {
      return [{ id: 'fallback', imageUrl: this.product.image, optimizedUrl: this.product.image, isPrimary: true, sortOrder: 0 }];
    }
    return imgs;
  }

  get hasMultipleImages(): boolean { return this.allImages.length > 1; }

  get activeImage(): string {
    const imgs = this.allImages;
    if (imgs.length === 0) return this.product?.image ?? '';
    return imgs[this.activeImageIndex]?.optimizedUrl || imgs[this.activeImageIndex]?.imageUrl || '';
  }

  prevImage(): void {
    this.activeImageIndex = (this.activeImageIndex - 1 + this.allImages.length) % this.allImages.length;
  }

  nextImage(): void {
    this.activeImageIndex = (this.activeImageIndex + 1) % this.allImages.length;
  }

  goToImage(i: number): void { this.activeImageIndex = i; }

  close() { this.state.closeProduct(); }
  changeQty(delta: number) { this.quantity = Math.max(1, this.quantity + delta); }
  addToCart() { if (this.product) { this.state.addToCart(this.product, this.quantity); } }
}