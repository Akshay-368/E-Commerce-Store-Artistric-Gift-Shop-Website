import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppStateService, ProductItem } from '../services/app-state.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <div class="image-wrap">
        <img [src]="product.image" [alt]="product.title" class="image" />
        <span class="badge">{{ product.category }}</span>
      </div>
      <div class="meta">
        <div class="title">{{ product.title }}</div>
        <div class="price">{{ product.price }}</div>
        <p class="desc">{{ product.description }}</p>
      </div>
      <button class="view" (click)="openDetails()">View Details</button>
    </article>
  `,
  styles: [
    `:host{display:block}
    .card{background:var(--color-card);border-radius:var(--radius);box-shadow:var(--shadow-card);overflow:hidden;display:flex;flex-direction:column;transition:var(--transition)}
    .card:hover{transform:translateY(-6px);box-shadow:var(--shadow-lift)}
    .image-wrap{position:relative;overflow:hidden;aspect-ratio:4/3;background:var(--color-sage)}
    .image{width:100%;height:100%;object-fit:cover;transition:transform 0.5s ease}
    .card:hover .image{transform:scale(1.06)}
    .badge{position:absolute;top:0.75rem;left:0.75rem;background:rgba(255,255,255,0.92);color:var(--color-primary-d);font-size:0.72rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:0.25rem 0.65rem;border-radius:50px;backdrop-filter:blur(4px)}
    .meta{padding:1.1rem 1.2rem 0.4rem;flex:1}
    .title{font-family:var(--font-ui);font-size:0.98rem;font-weight:600;color:var(--color-charcoal);line-height:1.3;margin-bottom:0.35rem}
    .price{font-family:var(--font-ui);font-size:1.1rem;font-weight:700;color:var(--color-primary)}
    .desc{font-size:0.83rem;color:var(--color-body);line-height:1.5;margin-top:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .view{display:block;width:calc(100% - 2.4rem);margin:0.75rem 1.2rem 1.2rem;padding:0.65rem;border-radius:var(--radius-sm);border:1.5px solid var(--color-border);background:transparent;color:var(--color-charcoal);font-size:0.875rem;font-weight:500;transition:var(--transition);text-align:center}
    .view:hover{border-color:var(--color-primary);color:var(--color-primary);background:rgba(136,173,53,0.05)}
    `
  ]
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductItem;
  constructor(private state: AppStateService) {}

  openDetails() { this.state.openProduct(this.product); }
}
