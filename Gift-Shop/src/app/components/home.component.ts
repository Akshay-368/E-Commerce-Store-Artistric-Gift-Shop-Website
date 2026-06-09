import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AppStateService, ProductItem, SiteContentItem, resolveSiteImageUrl } from '../services/app-state.service';
import { ProductCardComponent } from './product-card.component';
import { SectionSlideshowComponent } from './section-slideshow.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, SectionSlideshowComponent],
  template: `
    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 1 — HERO
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="hero" id="hero">
      <div class="hero-bg">
        <app-section-slideshow
          *ngIf="heroImages.length > 0"
          [images]="heroImages"
          [interval]="6000">
        </app-section-slideshow>
        <div class="hero-bg-fallback" *ngIf="heroImages.length === 0"></div>
      </div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">✨ New arrivals every week</div>
        <h1>{{ heroHeading || 'Welcome to' }} <em>{{ heroSubheading || 'Kalakaari Gifting' }}</em></h1>
        <p>{{ heroCopy || 'Discover the Charm of Handmade Art at Your Doorstep — thoughtfully crafted, beautifully wrapped, and designed to turn ordinary days into unforgettable celebrations.' }}</p>
        <div class="hero-cta-row">
          <button type="button" class="btn-hero-primary" (click)="scrollTo('catalog')">Explore the Gift Collection</button>
          <button type="button" class="btn-hero-ghost" (click)="scrollTo('manifesto')">Discover Our Story</button>
        </div>
      </div>
      <div class="hero-scroll">Scroll</div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 2 — MANIFESTO
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="manifesto" id="manifesto">
      <div class="manifesto-inner">
        <div class="section-eyebrow">Our Philosophy</div>
        <blockquote>
          {{ manifestoQuote || 'We believe that a gift shouldn\'t just be an object; it should be a tangible reflection of a connection. Every artistic piece in our boutique is hand-selected and crafted in limited numbers, ensuring that whatever you choose to share is as unique and wonderful as the person receiving it.' }}
        </blockquote>
        <p class="manifesto-sig">Kalakaari Gifting — Where creativity becomes a gift</p>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 3 — FEATURE ALPHA
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="feature-section" id="feature-1">
      <div class="container">
        <div class="feature-grid">
          <div class="feature-img-wrap">
            <app-section-slideshow *ngIf="feature1Images.length > 0" [images]="feature1Images" [interval]="5500"></app-section-slideshow>
            <img *ngIf="feature1Images.length === 0" src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1000&auto=format&fit=crop" alt="Crafted by hand" />
          </div>
          <div class="feature-text">
            <div class="section-eyebrow eyebrow-left">The Artist's Touch</div>
            <h2>Crafted by<br />Real Hands</h2>
            <p>{{ feature1Para1 || 'Unlike mass-produced store items, our fancy gift collections are born from local studio sessions. From initial sketch to final polish, each item carries distinct artistic character and absolute material perfection.' }}</p>
            <p>Every piece tells a story — of patience, skill, and genuine care for the person who will eventually receive it.</p>
            <div class="feature-detail">
              <span class="feature-detail-icon">🎨</span>
              <span>Each piece is handcrafted and one-of-a-kind — no two are exactly alike</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 4 — FEATURE BETA
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="feature-section alt" id="feature-2">
      <div class="container">
        <div class="feature-grid reverse">
          <div class="feature-img-wrap">
            <app-section-slideshow *ngIf="feature2Images.length > 0" [images]="feature2Images" [interval]="5000"></app-section-slideshow>
            <img *ngIf="feature2Images.length === 0" src="https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=1000&auto=format&fit=crop" alt="Unboxing experience" />
          </div>
          <div class="feature-text">
            <div class="section-eyebrow eyebrow-left">The Art of Giving</div>
            <h2>Unboxing<br />an Experience</h2>
            <p>{{ feature2Para1 || 'Presentation is half the magic of a thoughtful surprise. Every order is meticulously packaged in our signature keepsake boxing with a blank or custom-written message card, ready to delight them the exact second it arrives.' }}</p>
            <p>We believe the unwrapping moment is part of the gift itself — which is why we pour as much love into the packaging as the product inside.</p>
            <div class="feature-detail">
              <span class="feature-detail-icon">🎀</span>
              <span>Complimentary gift wrapping & handwritten note with every order</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 5 — HIGHLIGHTS
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="highlights" id="highlights">
      <div class="container">
        <div class="highlights-header">
          <div class="section-eyebrow">Why Choose Us</div>
          <h2>A Gift Boutique Like No Other</h2>
        </div>
        <div class="highlights-grid">
          <div class="highlight-card">
            <div class="highlight-icon-wrap">🎁</div>
            <h4>Complimentary Gift Wrapping</h4>
            <p>Every order arrives beautifully wrapped, ready to be gifted directly without any extra effort.</p>
          </div>
          <div class="highlight-card">
            <div class="highlight-icon-wrap">✨</div>
            <h4>100% Unique Artisan Designs</h4>
            <p>No factory-produced duplicates. Each piece is crafted in limited numbers by real artisans.</p>
          </div>
          <div class="highlight-card">
            <div class="highlight-icon-wrap">🚚</div>
            <h4>Fragile-Safe Nationwide Shipping</h4>
            <p>Specially packed to protect delicate handmade items during transit, delivered right to your door.</p>
          </div>
          <div class="highlight-card">
            <div class="highlight-icon-wrap">💌</div>
            <h4>Custom Handwritten Notes</h4>
            <p>Add a personal touch with a handwritten message card included with your order at no extra charge.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 6 — CATALOG
    ══════════════════════════════════════════════════════════════════════ -->
    <section class="catalog" id="catalog">
      <div class="container">
        <div class="catalog-header">
          <div class="catalog-title-group">
            <div class="section-eyebrow eyebrow-left">Our Products</div>
            <h2>Our Collection</h2>
            <p>Discover handcrafted pieces made with love and care</p>
          </div>
          <div class="catalog-controls">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search products..."
                [value]="searchQuery"
                (input)="onSearch($any($event.target).value)" />
            </div>
            <select class="filter-select"
              [value]="selectedCategory"
              (change)="onFilter($any($event.target).value)">
              <option value="">All Categories</option>
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
          </div>
        </div>

        <!-- Loading shimmer while products fetch -->
        <div class="product-grid" *ngIf="isLoading && !productsLoaded">
          <div class="product-skeleton" *ngFor="let s of skeletons"></div>
        </div>

        <!-- Actual product grid -->
        <div class="product-grid" *ngIf="productsLoaded || !isLoading">
          <app-product-card
            *ngFor="let product of visibleProducts; trackBy: trackById"
            [product]="product">
          </app-product-card>
        </div>

        <div class="empty-state" *ngIf="(productsLoaded || !isLoading) && filteredProducts.length === 0">
          <div class="empty-icon">🎁</div>
          <p *ngIf="searchQuery || selectedCategory">No products found matching your search.</p>
          <p *ngIf="!searchQuery && !selectedCategory">Our catalog is loading — check back shortly!</p>
        </div>

        <div class="load-more-row" *ngIf="hasMore">
          <button type="button" class="btn-load-more" (click)="loadMore()">✦ Explore More Creations</button>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════
         FOOTER
    ══════════════════════════════════════════════════════════════════════ -->
    <footer class="site-footer">
      <div class="container">
        <div class="footer-inner">
          <div class="footer-brand">
            <img src="/assets/Artistry-Giftopia-300x300.png" alt="Kalakaari Gifting" />
            <div class="footer-brand-text">
              <strong>Kalakaari Gifting</strong>
              <span>Where Creativity Becomes a Gift</span>
            </div>
          </div>
          <p class="footer-copy">Curating smiles and celebrating sweet connections since 2024. Made locally with love. 💚</p>
          <div class="footer-links">
            <a href="#catalog" (click)="scrollTo('catalog'); $event.preventDefault()">Browse Catalog</a>
            <a href="#manifesto" (click)="scrollTo('manifesto'); $event.preventDefault()">Our Story</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host{display:block}
    .hero{position:relative;min-height:90vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .hero-bg{position:absolute;inset:0}
    .hero-bg-fallback{position:absolute;inset:0;background-image:url('https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=2000&auto=format&fit=crop');background-size:cover;background-position:center}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(160deg,rgba(10,20,5,0.62) 0%,rgba(10,30,5,0.48) 50%,rgba(136,173,53,0.25) 100%);z-index:1;pointer-events:none}
    .hero-content{position:relative;z-index:2;text-align:center;max-width:780px;padding:2rem 1.5rem}
    .hero-badge{display:inline-flex;align-items:center;gap:0.5rem;background:rgba(236,244,211,0.18);border:1px solid rgba(236,244,211,0.4);backdrop-filter:blur(6px);color:var(--color-sage);padding:0.35rem 1rem;border-radius:50px;font-size:0.78rem;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:1.5rem}
    .hero-content h1{font-family:var(--font-display);font-size:clamp(2.4rem,5.5vw,4rem);font-weight:700;color:#fff;line-height:1.15;letter-spacing:-0.02em;margin-bottom:1.25rem}
    .hero-content h1 em{font-style:italic;color:var(--color-sage-m)}
    .hero-content p{font-size:clamp(1rem,1.6vw,1.15rem);color:rgba(236,244,211,0.88);max-width:580px;margin:0 auto 2.2rem;line-height:1.7}
    .hero-cta-row{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
    .btn-hero-primary,.btn-hero-ghost,.btn-load-more{font-family:var(--font-ui)}
    .btn-hero-primary{background:var(--color-primary);color:#fff;border:none;padding:0.85rem 2.2rem;border-radius:50px;font-size:1rem;font-weight:600;transition:var(--transition);box-shadow:0 4px 20px rgba(136,173,53,0.5)}
    .btn-hero-primary:hover{background:var(--color-primary-d);transform:translateY(-2px);box-shadow:0 8px 28px rgba(136,173,53,0.55)}
    .btn-hero-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,0.65);padding:0.85rem 2.2rem;border-radius:50px;font-size:1rem;font-weight:500;transition:var(--transition);backdrop-filter:blur(4px)}
    .btn-hero-ghost:hover{background:rgba(255,255,255,0.12);border-color:#fff}
    .hero-scroll{position:absolute;bottom:2.5rem;left:50%;transform:translateX(-50%);z-index:2;display:flex;flex-direction:column;align-items:center;gap:0.4rem;color:rgba(255,255,255,0.6);font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;animation:bounce 2s infinite}
    .hero-scroll::after{content:'↓';font-size:1.1rem}
    .manifesto{background:var(--color-sage);padding:5rem 0}
    .manifesto-inner{max-width:860px;margin:0 auto;text-align:center;padding:0 2rem}
    .section-eyebrow{font-size:0.78rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-primary);margin-bottom:1.2rem;display:flex;align-items:center;justify-content:center;gap:0.6rem}
    .section-eyebrow::before,.section-eyebrow::after{content:'';flex:1;max-width:60px;height:1px;background:var(--color-primary)}
    .eyebrow-left{justify-content:flex-start}
    .eyebrow-left::before{display:none}
    .eyebrow-left::after{max-width:36px}
    .manifesto blockquote{font-family:var(--font-display);font-size:clamp(1.2rem,2.4vw,1.65rem);font-style:italic;color:var(--color-charcoal);line-height:1.65;position:relative;padding:0 3rem}
    .manifesto blockquote::before{content:'"';font-size:7rem;line-height:0.7;color:var(--color-primary);opacity:0.3;position:absolute;top:0.4rem;left:0;font-style:normal}
    .manifesto-sig{margin-top:2rem;font-size:0.9rem;color:var(--color-body);font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.5rem}
    .manifesto-sig::before{content:'—'}
    .feature-section{padding:5.5rem 0;background:#fff}
    .feature-section.alt{background:var(--color-bg)}
    .feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center}
    .feature-grid.reverse{direction:rtl}
    .feature-grid.reverse>*{direction:ltr}
    .feature-img-wrap{position:relative;border-radius:var(--radius);overflow:hidden;aspect-ratio:4/5;box-shadow:var(--shadow-lift)}
    .feature-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform 0.6s ease}
    .feature-img-wrap:hover img{transform:scale(1.04)}
    .feature-img-wrap::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(34,34,34,0.15),transparent 60%);pointer-events:none;z-index:5}
    .feature-text{padding:1rem 0}
    .feature-text h2{font-family:var(--font-display);font-size:clamp(1.8rem,3.2vw,2.6rem);font-weight:700;color:var(--color-charcoal);line-height:1.2;margin-bottom:1.25rem;letter-spacing:-0.02em}
    .feature-text p{font-size:1.05rem;line-height:1.75;color:var(--color-body);margin-bottom:1.5rem}
    .feature-detail{display:flex;align-items:center;gap:0.8rem;background:var(--color-sage);border-radius:12px;padding:0.9rem 1.2rem;font-size:0.9rem;color:var(--color-charcoal);font-weight:500}
    .feature-detail-icon{font-size:1.4rem;flex-shrink:0}
    .highlights{background:var(--color-sage);padding:5rem 0}
    .highlights-header{text-align:center;margin-bottom:3.5rem}
    .highlights-header h2{font-family:var(--font-display);font-size:clamp(1.8rem,3vw,2.4rem);color:var(--color-charcoal);font-weight:700}
    .highlights-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem}
    .highlight-card{background:#fff;border-radius:var(--radius);padding:2rem 1.6rem;text-align:center;box-shadow:var(--shadow-card);transition:var(--transition)}
    .highlight-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-lift)}
    .highlight-icon-wrap{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 1rem}
    .highlight-card:nth-child(1) .highlight-icon-wrap{background:rgba(136,173,53,0.15)}
    .highlight-card:nth-child(2) .highlight-icon-wrap{background:rgba(136,173,53,0.12)}
    .highlight-card:nth-child(3) .highlight-icon-wrap{background:rgba(34,34,34,0.08)}
    .highlight-card:nth-child(4) .highlight-icon-wrap{background:rgba(105,137,39,0.12)}
    .highlight-card h4{font-family:var(--font-ui);font-size:1rem;font-weight:600;color:var(--color-charcoal);margin-bottom:0.4rem}
    .highlight-card p{font-size:0.88rem;color:var(--color-body);line-height:1.5}
    .catalog{padding:5.5rem 0;background:#fff}
    .catalog-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:2.5rem;gap:1.5rem;flex-wrap:wrap}
    .catalog-title-group h2{font-family:var(--font-display);font-size:clamp(1.8rem,3vw,2.4rem);color:var(--color-charcoal);font-weight:700;line-height:1.2}
    .catalog-title-group p{font-size:0.95rem;color:var(--color-body);margin-top:0.3rem}
    .catalog-controls{display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap}
    .search-wrap{position:relative}
    .search-wrap input{border:1.5px solid var(--color-border);border-radius:50px;padding:0.6rem 1rem 0.6rem 2.6rem;font-size:0.9rem;font-family:var(--font-ui);width:220px;outline:none;transition:var(--transition);background:var(--color-bg)}
    .search-wrap input:focus{border-color:var(--color-primary);background:#fff;box-shadow:0 0 0 3px rgba(136,173,53,0.15)}
    .search-icon{position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:var(--color-border);font-size:0.95rem;pointer-events:none}
    .filter-select{border:1.5px solid var(--color-border);border-radius:50px;padding:0.6rem 2rem 0.6rem 1rem;font-size:0.9rem;font-family:var(--font-ui);background:var(--color-bg);outline:none;cursor:pointer;transition:var(--transition)}
    .filter-select:focus{border-color:var(--color-primary)}
    .product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.75rem}
    /* Loading skeleton */
    .product-skeleton{height:360px;border-radius:var(--radius);background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.3s infinite}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .load-more-row{text-align:center;margin-top:3.5rem}
    .btn-load-more{background:transparent;border:2px solid var(--color-primary);color:var(--color-primary);padding:0.85rem 2.8rem;border-radius:50px;font-size:0.95rem;font-weight:600;transition:var(--transition)}
    .btn-load-more:hover{background:var(--color-primary);color:#fff}
    .empty-state{text-align:center;padding:4rem 0;color:var(--color-body)}
    .empty-icon{font-size:3rem;margin-bottom:1rem}
    .site-footer{background:var(--color-charcoal);color:rgba(255,255,255,0.7);padding:3rem 0 2rem}
    .footer-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1.5rem}
    .footer-brand{display:flex;align-items:center;gap:0.75rem}
    .footer-brand img{width:38px;height:38px;border-radius:8px}
    .footer-brand-text strong{display:block;font-size:0.95rem;color:#fff;font-family:var(--font-display)}
    .footer-brand-text span{font-size:0.78rem}
    .footer-copy{font-size:0.82rem;text-align:center}
    .footer-links{display:flex;gap:1.5rem;font-size:0.83rem}
    .footer-links a{transition:var(--transition)}
    .footer-links a:hover{color:var(--color-primary)}
    @keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(6px)}}
    @media (max-width:900px){.feature-grid{grid-template-columns:1fr;gap:2.5rem}.feature-grid.reverse{direction:ltr}.feature-img-wrap{aspect-ratio:16/9}.catalog-header{flex-direction:column;align-items:flex-start}}
    @media (max-width:600px){.product-grid{grid-template-columns:1fr 1fr;gap:1rem}.manifesto blockquote{padding:0 1rem}.footer-inner{flex-direction:column;align-items:center;text-align:center}.footer-links{justify-content:center;flex-wrap:wrap}}
    @media (max-width:420px){.product-grid{grid-template-columns:1fr}.hero-content h1{font-size:2rem}}
  `]
})
export class HomeComponent implements OnInit {
  private allProducts: ProductItem[] = [];

  searchQuery = '';
  selectedCategory = '';
  displayedCount = 8;   // initial grid size
  categories: string[] = [];
  isLoading = true;
  productsLoaded = false;
  skeletons = [1,2,3,4,5,6,7,8];

  heroImages: string[] = [];
  feature1Images: string[] = [];
  feature2Images: string[] = [];

  heroHeading: string | null = null;
  heroSubheading: string | null = null;
  heroCopy: string | null = null;
  manifestoQuote: string | null = null;
  feature1Para1: string | null = null;
  feature2Para1: string | null = null;

  constructor(private state: AppStateService) {}

  ngOnInit(): void {
    // Products subscription — reset displayedCount when the product list changes
    // so "load more" is computed against the new full list correctly.
    this.state.products$.subscribe(products => {
      this.allProducts = products;
      this.isLoading = false;
      this.productsLoaded = this.state.productsLoaded;
      this.categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
      // Reset page when the whole catalog refreshes (e.g. after admin adds a product)
      this.displayedCount = 8;
    });

    // Site content subscription — always resolves URLs correctly regardless of
    // whether images are binary-served (/api/content/{id}/image) or external URLs.
    this.state.siteContent$.subscribe(items => {
      this.heroImages    = this.buildImageUrls(items, 'hero');
      this.feature1Images = this.buildImageUrls(items, 'feature-1');
      this.feature2Images = this.buildImageUrls(items, 'feature-2');

      this.heroHeading    = this.getTextValue(items, 'hero.heading');
      this.heroSubheading = this.getTextValue(items, 'hero.subheading');
      this.heroCopy       = this.getTextValue(items, 'hero.copy');
      this.manifestoQuote = this.getTextValue(items, 'manifesto.quote');
      this.feature1Para1  = this.getTextValue(items, 'feature-1.para1');
      this.feature2Para1  = this.getTextValue(items, 'feature-2.para1');
    });
  }

  private buildImageUrls(items: SiteContentItem[], section: string): string[] {
    return items
      .filter(i => i.sectionName === section && i.kind === 'Image' && i.imageUrl)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(i => resolveSiteImageUrl(i.imageUrl)); // handles both external URLs and /api/... paths
  }

  private getTextValue(items: SiteContentItem[], key: string): string | null {
    return items.find(i => i.contentKey === key && i.kind === 'Text')?.textValue ?? null;
  }

  get filteredProducts(): ProductItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.allProducts.filter(p => {
      const matchesQuery = !q ||
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q);
      const matchesCat = !this.selectedCategory || p.category === this.selectedCategory;
      return matchesQuery && matchesCat;
    });
  }

  get visibleProducts(): ProductItem[] {
    return this.filteredProducts.slice(0, this.displayedCount);
  }

  get hasMore(): boolean {
    return this.filteredProducts.length > this.displayedCount;
  }

  onSearch(value: string): void { this.searchQuery = value; this.displayedCount = 8; }
  onFilter(value: string): void { this.selectedCategory = value; this.displayedCount = 8; }
  loadMore(): void { this.displayedCount += 8; }
  trackById(_: number, p: ProductItem): string { return p.id; }
  scrollTo(id: string): void { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
}