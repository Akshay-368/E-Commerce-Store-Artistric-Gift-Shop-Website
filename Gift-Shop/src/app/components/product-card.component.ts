import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { AppStateService, ProductItem } from '../services/app-state.service';
import { TelemetryService } from '../services/telemetry.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <div class="image-wrap">
        <!-- Multi-image slideshow on the card (auto-advances) -->
        <ng-container *ngIf="hasMultipleImages; else singleImage">
          <img
            *ngFor="let img of displayImages; let i = index"
            [src]="img.optimizedUrl || img.imageUrl"
            [alt]="img.altText || product.title"
            class="image slide-img"
            [class.active]="i === activeSlide" />
        </ng-container>
        <ng-template #singleImage>
          <img [src]="product.image || fallbackImage" [alt]="product.title" class="image" />
        </ng-template>

        <span class="badge">{{ product.category }}</span>

        <!-- Slide dots for product card -->
        <div class="card-dots" *ngIf="hasMultipleImages">
          <span *ngFor="let img of displayImages; let i = index"
                class="dot" [class.active]="i === activeSlide"
                (click)="$event.stopPropagation(); goToSlide(i)">
          </span>
        </div>
      </div>
      <div class="meta">
        <div class="title">{{ product.title }}</div>
        <div class="price">{{ product.price }}</div>
        <p class="desc">{{ product.shortDescription || product.description }}</p>
      </div>
      <button class="view" (click)="openDetails()">View Details</button>
    </article>
  `,
  styles: [`
    :host{display:block}
    .card{background:var(--color-card);border-radius:var(--radius);box-shadow:var(--shadow-card);overflow:hidden;display:flex;flex-direction:column;transition:var(--transition)}
    .card:hover{transform:translateY(-6px);box-shadow:var(--shadow-lift)}
    .image-wrap{position:relative;overflow:hidden;aspect-ratio:4/3;background:var(--color-sage)}
    .image{width:100%;height:100%;object-fit:cover;transition:transform 0.5s ease}
    .card:hover .image{transform:scale(1.06)}

    /* Slideshow within card */
    .slide-img{position:absolute;inset:0;opacity:0;transition:opacity 0.8s ease}
    .slide-img.active{opacity:1;position:relative}
    .slide-img:not(.active){position:absolute}

    .card-dots{position:absolute;bottom:0.5rem;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:5}
    .card-dots .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.8);cursor:pointer;transition:all 0.2s}
    .card-dots .dot.active{background:#fff;transform:scale(1.2)}

    .badge{position:absolute;top:0.75rem;left:0.75rem;background:rgba(255,255,255,0.92);color:var(--color-primary-d);font-size:0.72rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:0.25rem 0.65rem;border-radius:50px;backdrop-filter:blur(4px);z-index:3}
    .meta{padding:1.1rem 1.2rem 0.4rem;flex:1}
    .title{font-family:var(--font-ui);font-size:0.98rem;font-weight:600;color:var(--color-charcoal);line-height:1.3;margin-bottom:0.35rem}
    .price{font-family:var(--font-ui);font-size:1.1rem;font-weight:700;color:var(--color-primary)}
    .desc{font-size:0.83rem;color:var(--color-body);line-height:1.5;margin-top:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .view{display:block;width:calc(100% - 2.4rem);margin:0.75rem 1.2rem 1.2rem;padding:0.65rem;border-radius:var(--radius-sm);border:1.5px solid var(--color-border);background:transparent;color:var(--color-charcoal);font-size:0.875rem;font-weight:500;transition:var(--transition);text-align:center}
    .view:hover{border-color:var(--color-primary);color:var(--color-primary);background:rgba(136,173,53,0.05)}
  `]
})
export class ProductCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) product!: ProductItem;

  readonly fallbackImage = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600&auto=format&fit=crop';

  activeSlide = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  get displayImages() { return this.product.images ?? []; }
  get hasMultipleImages() { return this.displayImages.length > 1; }

  constructor(private state: AppStateService , private telemetry: TelemetryService) {}

  ngOnInit(): void {
    if (this.hasMultipleImages) {
      this.timer = setInterval(() => {
        this.activeSlide = (this.activeSlide + 1) % this.displayImages.length;
      }, 4000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  goToSlide(i: number): void { this.activeSlide = i; }
  openDetails() { this.state.openProduct(this.product); this.telemetry.trackUserAction('Someone is viewing the details of the product -', this.product?.title ?? 'unkown');}
}