import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { AppStateService, ProductImage, ProductItem } from '../services/app-state.service';
import { TelemetryService } from '../services/telemetry.service';

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
        <!-- Main display image with Amazon-like hover zoom and click to expand -->
        <div
          class="gallery-main"
          (mousemove)="onMouseMove($event)"
          (mouseenter)="onMouseEnter()"
          (mouseleave)="onMouseLeave()"
          (click)="openLightbox()"
          [class.is-zooming]="isHoverZooming"
          title="Click for full-screen zoom view"
        >
          <img
            [src]="activeImage"
            [alt]="product.title"
            class="gallery-main-img"
            [class.zoomed]="isHoverZooming"
            [style.transform-origin]="zoomOrigin"
          />

          <!-- Amazon-like hover hint badge -->
          <div class="zoom-badge" *ngIf="!isHoverZooming">
            <span class="zoom-icon">🔍</span>
            <span>Hover to zoom · Click to expand</span>
          </div>

          <!-- Arrow navigation for multiple images -->
          <button
            *ngIf="hasMultipleImages"
            class="gallery-arrow left"
            (click)="$event.stopPropagation(); prevImage()"
            type="button"
            aria-label="Previous image">‹</button>
          <button
            *ngIf="hasMultipleImages"
            class="gallery-arrow right"
            (click)="$event.stopPropagation(); nextImage()"
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

    <!-- ── Amazon-Style Fullscreen Lightbox / Zoom Modal ───────────── -->
    <div class="lightbox-overlay" *ngIf="isLightboxOpen" (click)="closeLightbox()">
      <div class="lightbox-dialog" (click)="$event.stopPropagation()">
        <!-- Lightbox Header / Controls -->
        <div class="lightbox-header">
          <div class="lightbox-title">{{ product?.title }}</div>
          <div class="lightbox-actions">
            <div class="zoom-controls">
              <button
                type="button"
                class="lb-btn"
                (click)="zoomOutModal()"
                [disabled]="modalZoomScale <= 1"
                title="Zoom Out (−)">−</button>
              <span class="lb-zoom-level">{{ roundedZoom }}%</span>
              <button
                type="button"
                class="lb-btn"
                (click)="zoomInModal()"
                [disabled]="modalZoomScale >= 4"
                title="Zoom In (+)">+</button>
              <button
                type="button"
                class="lb-btn lb-btn-reset"
                (click)="resetModalZoom()"
                title="Reset Zoom">Reset</button>
            </div>
            <button
              type="button"
              class="lb-btn lb-close"
              (click)="closeLightbox()"
              aria-label="Close fullscreen view">✕</button>
          </div>
        </div>

        <!-- Lightbox Viewport: Drag to pan & Mouse wheel to zoom -->
        <div
          class="lightbox-viewport"
          (wheel)="onModalWheel($event)"
          (mousedown)="startPan($event)"
          (mousemove)="onPan($event)"
          (mouseup)="endPan()"
          (mouseleave)="endPan()"
          [class.can-pan]="modalZoomScale > 1"
          [class.panning]="isPanning"
        >
          <img
            [src]="activeImage"
            [alt]="product?.title || 'Product image'"
            class="lightbox-img"
            [style.transform]="'translate(' + panX + 'px, ' + panY + 'px) scale(' + modalZoomScale + ')'"
            draggable="false"
          />

          <!-- Modal prev/next navigation -->
          <button
            *ngIf="hasMultipleImages"
            class="lb-arrow lb-prev"
            (click)="prevImage(); resetModalZoom()"
            type="button"
            aria-label="Previous image">‹</button>
          <button
            *ngIf="hasMultipleImages"
            class="lb-arrow lb-next"
            (click)="nextImage(); resetModalZoom()"
            type="button"
            aria-label="Next image">›</button>
        </div>

        <!-- Lightbox Thumbnails -->
        <div class="lightbox-thumbs" *ngIf="hasMultipleImages">
          <button
            *ngFor="let img of allImages; let i = index"
            class="lb-thumb-btn"
            [class.active]="i === activeImageIndex"
            (click)="goToImage(i); resetModalZoom()"
            type="button">
            <img [src]="img.optimizedUrl || img.imageUrl" [alt]="img.altText || product?.title" />
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{position:fixed;inset:0;pointer-events:none;z-index:900}
    .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity 0.3s}
    .drawer-overlay.active{opacity:1;pointer-events:auto}
    .drawer{position:fixed;right:0;top:0;height:100vh;width:min(600px,100vw);background:#fff;overflow-y:auto;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.25,0.8,0.25,1);box-shadow:-12px 0 48px rgba(34,34,34,0.15);pointer-events:auto}
    .drawer.open{transform:translateX(0)}
    .drawer-close{position:sticky;top:0;background:#fff;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(209,209,209,0.4)}
    .drawer-close span{font-size:0.8rem;font-weight:600;color:var(--color-body);letter-spacing:0.06em;text-transform:uppercase}
    .drawer-close-btn{background:var(--color-bg);border:none;width:36px;height:36px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition);cursor:pointer}
    .drawer-close-btn:hover{background:var(--color-border)}

    /* ── Gallery ──────────────────────────────────────────────────── */
    .gallery-wrap{background:#f8f9fa;border-bottom:1px solid rgba(209,209,209,0.5)}
    .gallery-main{
      position:relative;
      aspect-ratio:1/1;
      min-height:360px;
      max-height:480px;
      overflow:hidden;
      background:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:zoom-in;
      user-select:none;
    }
    .gallery-main-img{
      width:100%;
      height:100%;
      object-fit:contain;
      padding:1rem;
      transition:transform 0.15s ease-out, opacity 0.3s ease;
      will-change:transform;
    }
    .gallery-main-img.zoomed{
      transform:scale(2.2);
    }
    .zoom-badge{
      position:absolute;
      bottom:0.75rem;
      left:50%;
      transform:translateX(-50%);
      background:rgba(20,20,20,0.72);
      color:#fff;
      font-size:0.75rem;
      font-weight:500;
      padding:0.35rem 0.85rem;
      border-radius:50px;
      backdrop-filter:blur(6px);
      display:flex;
      align-items:center;
      gap:0.4rem;
      pointer-events:none;
      transition:opacity 0.2s ease;
      box-shadow:0 2px 10px rgba(0,0,0,0.18);
      z-index:4;
    }
    .zoom-icon{font-size:0.85rem}
    .gallery-arrow{
      position:absolute;
      top:50%;
      transform:translateY(-50%);
      background:rgba(255,255,255,0.85);
      color:var(--color-charcoal);
      border:1px solid rgba(0,0,0,0.08);
      width:38px;
      height:38px;
      border-radius:50%;
      font-size:1.4rem;
      line-height:1;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      z-index:5;
      transition:var(--transition);
      backdrop-filter:blur(8px);
      box-shadow:0 2px 8px rgba(0,0,0,0.12);
    }
    .gallery-arrow:hover{
      background:#fff;
      color:var(--color-primary);
      transform:translateY(-50%) scale(1.08);
      box-shadow:0 4px 14px rgba(0,0,0,0.18);
    }
    .gallery-arrow.left{left:0.75rem}
    .gallery-arrow.right{right:0.75rem}
    .gallery-thumbs{display:flex;gap:0.5rem;padding:0.75rem 1rem;background:#f8f9fa;overflow-x:auto;scrollbar-width:thin}
    .thumb-btn{flex-shrink:0;width:62px;height:62px;border-radius:8px;overflow:hidden;border:2px solid transparent;background:#fff;cursor:pointer;padding:2px;transition:var(--transition);box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .thumb-btn.active{border-color:var(--color-primary);box-shadow:0 0 0 1px var(--color-primary)}
    .thumb-btn img{width:100%;height:100%;object-fit:contain}
    .gallery-dots{display:flex;justify-content:center;gap:6px;padding:0.6rem 0;background:#f8f9fa}
    .gallery-dots .dot{width:8px;height:8px;border-radius:50%;background:rgba(34,34,34,0.25);cursor:pointer;transition:all 0.2s}
    .gallery-dots .dot.active{background:var(--color-primary);transform:scale(1.25)}

    /* ── Fullscreen Lightbox Modal ────────────────────────────────── */
    .lightbox-overlay{
      position:fixed;
      inset:0;
      background:rgba(12,14,18,0.92);
      backdrop-filter:blur(8px);
      z-index:1000;
      display:flex;
      align-items:center;
      justify-content:center;
      animation:lbFadeIn 0.25s ease-out;
      pointer-events:auto;
    }
    @keyframes lbFadeIn{
      from{opacity:0}
      to{opacity:1}
    }
    .lightbox-dialog{
      position:relative;
      width:100vw;
      height:100vh;
      display:flex;
      flex-direction:column;
    }
    .lightbox-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:1rem 1.75rem;
      background:rgba(20,24,30,0.85);
      border-bottom:1px solid rgba(255,255,255,0.1);
      z-index:10;
    }
    .lightbox-title{
      color:#fff;
      font-size:1.1rem;
      font-weight:600;
      font-family:var(--font-ui);
      max-width:60%;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .lightbox-actions{
      display:flex;
      align-items:center;
      gap:1rem;
    }
    .zoom-controls{
      display:flex;
      align-items:center;
      background:rgba(255,255,255,0.12);
      border-radius:50px;
      padding:3px;
      border:1px solid rgba(255,255,255,0.15);
    }
    .lb-btn{
      background:transparent;
      border:none;
      color:#fff;
      width:34px;
      height:34px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:1.1rem;
      font-weight:600;
      cursor:pointer;
      transition:var(--transition);
    }
    .lb-btn:hover:not(:disabled){
      background:rgba(255,255,255,0.22);
      color:#fff;
    }
    .lb-btn:disabled{
      opacity:0.35;
      cursor:not-allowed;
    }
    .lb-btn-reset{
      width:auto;
      padding:0 0.75rem;
      font-size:0.78rem;
      border-radius:50px;
    }
    .lb-zoom-level{
      color:#fff;
      font-size:0.82rem;
      font-weight:600;
      padding:0 0.5rem;
      min-width:44px;
      text-align:center;
    }
    .lb-close{
      background:rgba(255,255,255,0.12);
      border:1px solid rgba(255,255,255,0.15);
      border-radius:50%;
      width:38px;
      height:38px;
    }
    .lb-close:hover{
      background:rgba(220,53,69,0.85);
      border-color:transparent;
    }
    .lightbox-viewport{
      flex:1;
      position:relative;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:default;
    }
    .lightbox-viewport.can-pan{
      cursor:grab;
    }
    .lightbox-viewport.panning{
      cursor:grabbing;
    }
    .lightbox-img{
      max-width:90%;
      max-height:82vh;
      object-fit:contain;
      user-select:none;
      transition:transform 0.15s ease-out;
      will-change:transform;
    }
    .lb-arrow{
      position:absolute;
      top:50%;
      transform:translateY(-50%);
      background:rgba(255,255,255,0.18);
      color:#fff;
      border:1px solid rgba(255,255,255,0.2);
      width:48px;
      height:48px;
      border-radius:50%;
      font-size:1.8rem;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      backdrop-filter:blur(8px);
      transition:var(--transition);
      z-index:5;
    }
    .lb-arrow:hover{
      background:rgba(255,255,255,0.35);
      transform:translateY(-50%) scale(1.08);
    }
    .lb-prev{left:1.5rem}
    .lb-next{right:1.5rem}
    .lightbox-thumbs{
      display:flex;
      justify-content:center;
      gap:0.75rem;
      padding:0.75rem;
      background:rgba(18,22,28,0.9);
      border-top:1px solid rgba(255,255,255,0.08);
    }
    .lb-thumb-btn{
      width:52px;
      height:52px;
      border-radius:6px;
      border:2px solid transparent;
      background:#fff;
      padding:2px;
      cursor:pointer;
      transition:var(--transition);
      opacity:0.6;
    }
    .lb-thumb-btn.active{
      border-color:var(--color-primary);
      opacity:1;
      transform:scale(1.08);
    }
    .lb-thumb-btn img{width:100%;height:100%;object-fit:contain}

    /* ── Product info ───────────────────────────────────────────────── */
    .drawer-body{padding:1.75rem 1.5rem}
    .drawer-category{font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-primary);margin-bottom:0.5rem}
    .drawer-title{font-family:var(--font-display);font-size:1.7rem;font-weight:700;color:var(--color-charcoal);line-height:1.2;margin-bottom:0.75rem}
    .drawer-price{font-family:var(--font-ui);font-size:1.5rem;font-weight:700;color:var(--color-primary);margin-bottom:1.25rem}
    .drawer-desc{font-size:0.98rem;color:var(--color-body);line-height:1.75;border-top:1px solid rgba(209,209,209,0.4);padding-top:1.25rem;margin-bottom:1.5rem}
    .drawer-qty-row{display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem}
    .drawer-qty-label{font-size:0.875rem;font-weight:500;color:var(--color-charcoal)}
    .qty-control{display:flex;align-items:center;gap:0.5rem}
    .qty-btn{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--color-border);background:transparent;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition);cursor:pointer}
    .qty-btn:hover{border-color:var(--color-primary);color:var(--color-primary)}
    .qty-value{font-weight:600;font-size:1rem;min-width:24px;text-align:center}
    .btn-add-to-cart{width:100%;padding:1rem;background:var(--color-primary);color:#fff;border:none;border-radius:50px;font-size:1rem;font-weight:600;transition:var(--transition);box-shadow:0 4px 16px rgba(136,173,53,0.4);cursor:pointer}
    .btn-add-to-cart:hover{background:var(--color-primary-d);transform:translateY(-2px);box-shadow:0 8px 24px rgba(136,173,53,0.45)}
  `]
})
export class ProductDetailDrawerComponent {
  product: ProductItem | null = null;
  quantity = 1;
  activeImageIndex = 0;

  // Amazon-like in-place hover zoom state
  isHoverZooming = false;
  zoomOrigin = '50% 50%';

  // Lightbox fullscreen zoom modal state
  isLightboxOpen = false;
  modalZoomScale = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  private startX = 0;
  private startY = 0;

  constructor(
    private state: AppStateService,
    private telemetry: TelemetryService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.state.selectedProduct$.subscribe(p => {
      this.product = p;
      this.quantity = 1;
      this.activeImageIndex = 0;
      this.isHoverZooming = false;
      this.closeLightbox();
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

  get roundedZoom(): number {
    return Math.round(this.modalZoomScale * 100);
  }

  // ── Hover Zoom Controls ──────────────────────────────────────────
  onMouseMove(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    this.zoomOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }

  onMouseEnter(): void {
    this.isHoverZooming = true;
  }

  onMouseLeave(): void {
    this.isHoverZooming = false;
    this.zoomOrigin = '50% 50%';
  }

  // ── Fullscreen Lightbox Controls ────────────────────────────────
  openLightbox(): void {
    this.isLightboxOpen = true;
    this.resetModalZoom();
    this.telemetry.trackUserAction('Someone opened image zoom view', this.product?.title ?? 'unknown');
  }

  closeLightbox(): void {
    this.isLightboxOpen = false;
    this.resetModalZoom();
  }

  zoomInModal(): void {
    this.modalZoomScale = Math.min(4, +(this.modalZoomScale + 0.5).toFixed(1));
  }

  zoomOutModal(): void {
    this.modalZoomScale = Math.max(1, +(this.modalZoomScale - 0.5).toFixed(1));
    if (this.modalZoomScale === 1) {
      this.panX = 0;
      this.panY = 0;
    }
  }

  resetModalZoom(): void {
    this.modalZoomScale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
  }

  onModalWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) {
      this.zoomInModal();
    } else {
      this.zoomOutModal();
    }
  }

  startPan(e: MouseEvent): void {
    if (this.modalZoomScale <= 1) return;
    this.isPanning = true;
    this.startX = e.clientX - this.panX;
    this.startY = e.clientY - this.panY;
  }

  onPan(e: MouseEvent): void {
    if (!this.isPanning || this.modalZoomScale <= 1) return;
    this.panX = e.clientX - this.startX;
    this.panY = e.clientY - this.startY;
  }

  endPan(): void {
    this.isPanning = false;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (!isPlatformBrowser(this.platformId) || !this.isLightboxOpen) return;
    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowLeft' && this.hasMultipleImages) {
      this.prevImage();
      this.resetModalZoom();
    } else if (event.key === 'ArrowRight' && this.hasMultipleImages) {
      this.nextImage();
      this.resetModalZoom();
    }
  }

  // ── Navigation & Actions ─────────────────────────────────────────
  prevImage(): void {
    this.activeImageIndex = (this.activeImageIndex - 1 + this.allImages.length) % this.allImages.length;
  }

  nextImage(): void {
    this.activeImageIndex = (this.activeImageIndex + 1) % this.allImages.length;
    this.telemetry.trackUserAction('Someone is viewing the image', this.activeImageIndex.toString() ?? 'unknown');
  }

  goToImage(i: number): void {
    this.activeImageIndex = i;
  }

  close(): void {
    this.closeLightbox();
    this.state.closeProduct();
  }

  changeQty(delta: number): void {
    this.quantity = Math.max(1, this.quantity + delta);
    this.telemetry.trackUserAction('Someone increased the quantity of the product', this.product?.title ?? 'unknown');
  }

  addToCart(): void {
    if (this.product) {
      this.state.addToCart(this.product, this.quantity);
      this.telemetry.trackUserAction('Someone added something to their cart, product -', this.product?.title ?? 'unknown');
    }
  }
}