import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppStateService, ProductItem, SiteContentItem, resolveSiteImageUrl
} from '../services/app-state.service';
import { TelemetryService } from '../services/telemetry.service';
import { ProductCardComponent } from './product-card.component';
import { SectionSlideshowComponent } from './section-slideshow.component';

/** Default highlight cards used when the DB has not yet been seeded. */
const DEFAULT_HIGHLIGHTS = [
  { icon: '🎁', title: 'Complimentary Gift Wrapping',    body: 'Every order arrives beautifully wrapped, ready to be gifted directly without any extra effort.' },
  { icon: '✨', title: '100% Unique Artisan Designs',    body: 'No factory-produced duplicates. Each piece is crafted in limited numbers by real artisans.' },
  { icon: '🚚', title: 'Fragile-Safe Nationwide Shipping', body: 'Specially packed to protect delicate handmade items during transit, delivered right to your door.' },
  { icon: '💌', title: 'Custom Handwritten Notes',        body: 'Add a personal touch with a handwritten message card included with your order at no extra charge.' },
];

export interface HighlightCard { icon: string; title: string; body: string; }

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule, ProductCardComponent, SectionSlideshowComponent],
  template: `
    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 1 — HERO
    ═══════════════════════════════════════════════════════════════════ -->
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
        <div class="hero-badge">{{ heroBadge || '✨ New arrivals every week' }}</div>
        <h1>{{ heroHeading || 'Welcome to' }} <em>{{ heroSubheading || 'Kalakaari Gifting' }}</em></h1>
        <p>{{ heroCopy || 'Discover the Charm of Handmade Art at Your Doorstep — thoughtfully crafted, beautifully wrapped, and designed to turn ordinary days into unforgettable celebrations.' }}</p>
        <div class="hero-cta-row">
          <button type="button" class="btn-hero-primary" (click)="scrollTo('catalog')">Explore the Gift Collection</button>
          <button type="button" class="btn-hero-ghost" (click)="scrollTo('manifesto')">Discover Our Story</button>
        </div>
      </div>
      <div class="hero-scroll">Scroll</div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 2 — MANIFESTO
    ═══════════════════════════════════════════════════════════════════ -->
    <section class="manifesto" id="manifesto">
      <div class="manifesto-inner">
        <div class="section-eyebrow">Our Philosophy</div>
        <blockquote>
          {{ manifestoQuote || 'We believe that a gift shouldn\'t just be an object; it should be a tangible reflection of a connection. Every artistic piece in our boutique is hand-selected and crafted in limited numbers, ensuring that whatever you choose to share is as unique and wonderful as the person receiving it.' }}
        </blockquote>
        <p class="manifesto-sig">Kalakaari Gifting — Where creativity becomes a gift</p>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 3 — FEATURE ALPHA
    ═══════════════════════════════════════════════════════════════════ -->
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

    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 4 — FEATURE BETA
    ═══════════════════════════════════════════════════════════════════ -->
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

    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 5 — HIGHLIGHTS (Why Choose Us)
    ═══════════════════════════════════════════════════════════════════ -->
    <section class="highlights" id="highlights">
      <div class="container">
        <div class="highlights-header">
          <div class="section-eyebrow">{{ highlightsEyebrow || 'Why Choose Us' }}</div>
          <h2>{{ highlightsTitle || 'A Gift Boutique Like No Other' }}</h2>
        </div>
        <div class="highlights-grid">
          <div class="highlight-card" *ngFor="let card of highlightCards; let i = index">
            <div class="highlight-icon-wrap" [class]="'icon-bg-' + (i % 4)">{{ card.icon }}</div>
            <h4>{{ card.title }}</h4>
            <p>{{ card.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════
         SECTION 6 — CATALOG
    ═══════════════════════════════════════════════════════════════════ -->
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

        <div class="product-grid" *ngIf="isLoading">
          <div class="product-skeleton" *ngFor="let s of skeletons"></div>
        </div>

        <ng-container *ngIf="!isLoading">
          <div class="product-grid" *ngIf="visibleProducts.length > 0">
            <app-product-card
              *ngFor="let product of visibleProducts; trackBy: trackById"
              [product]="product">
            </app-product-card>
          </div>

          <div class="empty-state" *ngIf="filteredProducts.length === 0">
            <div class="empty-icon">🎁</div>
            <p *ngIf="searchQuery || selectedCategory">No products found matching your search.</p>
            <p *ngIf="!searchQuery && !selectedCategory">Our catalog is being loaded — check back shortly!</p>
          </div>
        </ng-container>

        <div class="load-more-row" *ngIf="!isLoading && hasMore">
          <button type="button" class="btn-load-more" (click)="loadMore()">✦ Explore More Creations</button>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════
         FOOTER
    ═══════════════════════════════════════════════════════════════════ -->
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <!-- Brand block -->
          <div class="footer-brand">
            <img [src]="footerLogoSrc" [alt]="footerBrandName" />
            <!-- <img src="/assets/Artistry-Giftopia-300x300.png" [alt]="footerBrandName" /> -->
            <div class="footer-brand-text">
              <strong>{{ footerBrandName }}</strong>
              <span>{{ footerBrandTagline }}</span>
            </div>
          </div>
          <!-- Copy -->
          <p class="footer-copy">{{ footerCopy }}</p>
          <!-- Primary nav links -->
          <div class="footer-links">
            <a href="#catalog"   (click)="scrollTo('catalog');   $event.preventDefault()">{{ footerLinkCatalog }}</a>
            <a href="#manifesto" (click)="scrollTo('manifesto'); $event.preventDefault()">{{ footerLinkStory }}</a>
          </div>
        </div>

        <div class="footer-bottom">
          <span class="footer-copy-small">© {{ year }} {{ footerBrandName }}. All rights reserved.</span>
          <div class="footer-util-links">
            <button class="footer-util-btn" type="button" (click)="openModal('contact')">Contact Us</button>
            <button class="footer-util-btn" type="button" (click)="openModal('terms')">Terms & Policies</button>
          </div>
        </div>
      </div>
    </footer>

    <!-- ═══ Contact Us Modal ═══ -->
    <div class="ft-modal-backdrop" *ngIf="openModalKey === 'contact'" (click)="closeModal()">
      <div class="ft-modal" (click)="$event.stopPropagation()">
        <div class="ft-modal-header">
          <h3>Contact Us</h3>
          <button class="ft-close" (click)="closeModal()">✕</button>
        </div>
        <div class="ft-modal-body" *ngIf="contactContent || contactSocials.length > 0; else noContent">
          <!-- Social links (from socialLinks$ observable) -->
          <div *ngIf="contactSocials.length > 0" class="contact-socials">
            <a *ngFor="let s of contactSocials" [href]="s.url" target="_blank" rel="noopener" class="social-link">
              <span class="social-emoji">{{ s.icon }}</span>
              <span>{{ s.name }}</span>
            </a>
          </div>
          <!-- Free-form contact info text -->
          <pre class="contact-info-text" *ngIf="contactContent">{{ contactContent }}</pre>
        </div>
        <ng-template #noContent>
          <p class="ft-empty">Contact information hasn't been set up yet. Check back soon!</p>
        </ng-template>
      </div>
    </div>

    <!-- ═══ Terms & Policies Modal ═══ -->
    <div class="ft-modal-backdrop" *ngIf="openModalKey === 'terms'" (click)="closeModal()">
      <div class="ft-modal ft-modal-wide" (click)="$event.stopPropagation()">
        <div class="ft-modal-header">
          <h3>Terms &amp; Policies</h3>
          <button class="ft-close" (click)="closeModal()">✕</button>
        </div>
        <div class="ft-modal-body">
          <div *ngIf="termsContent" class="ft-prose">{{ termsContent }}</div>
          <p *ngIf="!termsContent" class="ft-empty">Terms and policies haven't been written yet. Check back soon!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block }
    .hero { position:relative;min-height:90vh;display:flex;align-items:center;justify-content:center;overflow:hidden }
    .hero-bg { position:absolute;inset:0 }
    .hero-bg-fallback { position:absolute;inset:0;background-image:url('https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=2000&auto=format&fit=crop');background-size:cover;background-position:center }
    .hero-overlay { position:absolute;inset:0;background:linear-gradient(160deg,rgba(10,20,5,0.62) 0%,rgba(10,30,5,0.48) 50%,rgba(136,173,53,0.25) 100%);z-index:1;pointer-events:none }
    .hero-content { position:relative;z-index:2;text-align:center;max-width:780px;padding:2rem 1.5rem }
    .hero-badge { display:inline-flex;align-items:center;gap:0.5rem;background:rgba(236,244,211,0.18);border:1px solid rgba(236,244,211,0.4);backdrop-filter:blur(6px);color:var(--color-sage);padding:0.35rem 1rem;border-radius:50px;font-size:0.78rem;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:1.5rem }
    .hero-content h1 { font-family:var(--font-display);font-size:clamp(2.4rem,5.5vw,4rem);font-weight:700;color:#fff;line-height:1.15;letter-spacing:-0.02em;margin-bottom:1.25rem }
    .hero-content h1 em { font-style:italic;color:var(--color-sage-m) }
    .hero-content p { font-size:clamp(1rem,1.6vw,1.15rem);color:rgba(236,244,211,0.88);max-width:580px;margin:0 auto 2.2rem;line-height:1.7 }
    .hero-cta-row { display:flex;gap:1rem;justify-content:center;flex-wrap:wrap }
    .btn-hero-primary,.btn-hero-ghost,.btn-load-more { font-family:var(--font-ui) }
    .btn-hero-primary { background:var(--color-primary);color:#fff;border:none;padding:0.85rem 2.2rem;border-radius:50px;font-size:1rem;font-weight:600;transition:var(--transition);box-shadow:0 4px 20px rgba(136,173,53,0.5) }
    .btn-hero-primary:hover { background:var(--color-primary-d);transform:translateY(-2px);box-shadow:0 8px 28px rgba(136,173,53,0.55) }
    .btn-hero-ghost { background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,0.65);padding:0.85rem 2.2rem;border-radius:50px;font-size:1rem;font-weight:500;transition:var(--transition);backdrop-filter:blur(4px) }
    .btn-hero-ghost:hover { background:rgba(255,255,255,0.12);border-color:#fff }
    .hero-scroll { position:absolute;bottom:2.5rem;left:50%;transform:translateX(-50%);z-index:2;display:flex;flex-direction:column;align-items:center;gap:0.4rem;color:rgba(255,255,255,0.6);font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;animation:bounce 2s infinite }
    .hero-scroll::after { content:'↓';font-size:1.1rem }
    .manifesto { background:var(--color-sage);padding:5rem 0 }
    .manifesto-inner { max-width:860px;margin:0 auto;text-align:center;padding:0 2rem }
    .section-eyebrow { font-size:0.78rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-primary);margin-bottom:1.2rem;display:flex;align-items:center;justify-content:center;gap:0.6rem }
    .section-eyebrow::before,.section-eyebrow::after { content:'';flex:1;max-width:60px;height:1px;background:var(--color-primary) }
    .eyebrow-left { justify-content:flex-start }
    .eyebrow-left::before { display:none }
    .eyebrow-left::after { max-width:36px }
    .manifesto blockquote { font-family:var(--font-display);font-size:clamp(1.2rem,2.4vw,1.65rem);font-style:italic;color:var(--color-charcoal);line-height:1.65;position:relative;padding:0 3rem }
    .manifesto blockquote::before { content:'"';font-size:7rem;line-height:0.7;color:var(--color-primary);opacity:0.3;position:absolute;top:0.4rem;left:0;font-style:normal }
    .manifesto-sig { margin-top:2rem;font-size:0.9rem;color:var(--color-body);font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.5rem }
    .manifesto-sig::before { content:'—' }
    .feature-section { padding:5.5rem 0;background:#fff }
    .feature-section.alt { background:var(--color-bg) }
    .feature-grid { display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center }
    .feature-grid.reverse { direction:rtl }
    .feature-grid.reverse>* { direction:ltr }
    .feature-img-wrap { position:relative;border-radius:var(--radius);overflow:hidden;aspect-ratio:4/5;box-shadow:var(--shadow-lift) }
    .feature-img-wrap img { width:100%;height:100%;object-fit:cover;transition:transform 0.6s ease }
    .feature-img-wrap:hover img { transform:scale(1.04) }
    .feature-img-wrap::after { content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(34,34,34,0.15),transparent 60%);pointer-events:none;z-index:5 }
    .feature-text { padding:1rem 0 }
    .feature-text h2 { font-family:var(--font-display);font-size:clamp(1.8rem,3.2vw,2.6rem);font-weight:700;color:var(--color-charcoal);line-height:1.2;margin-bottom:1.25rem;letter-spacing:-0.02em }
    .feature-text p { font-size:1.05rem;line-height:1.75;color:var(--color-body);margin-bottom:1.5rem }
    .feature-detail { display:flex;align-items:center;gap:0.8rem;background:var(--color-sage);border-radius:12px;padding:0.9rem 1.2rem;font-size:0.9rem;color:var(--color-charcoal);font-weight:500 }
    .feature-detail-icon { font-size:1.4rem;flex-shrink:0 }
    .highlights { background:var(--color-sage);padding:5rem 0 }
    .highlights-header { text-align:center;margin-bottom:3.5rem }
    .highlights-header h2 { font-family:var(--font-display);font-size:clamp(1.8rem,3vw,2.4rem);color:var(--color-charcoal);font-weight:700 }
    .highlights-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem }
    .highlight-card { background:#fff;border-radius:var(--radius);padding:2rem 1.6rem;text-align:center;box-shadow:var(--shadow-card);transition:var(--transition) }
    .highlight-card:hover { transform:translateY(-5px);box-shadow:var(--shadow-lift) }
    .highlight-icon-wrap { width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 1rem }
    .icon-bg-0 { background:rgba(136,173,53,0.15) }
    .icon-bg-1 { background:rgba(136,173,53,0.12) }
    .icon-bg-2 { background:rgba(34,34,34,0.08) }
    .icon-bg-3 { background:rgba(105,137,39,0.12) }
    .highlight-card h4 { font-family:var(--font-ui);font-size:1rem;font-weight:600;color:var(--color-charcoal);margin-bottom:0.4rem }
    .highlight-card p { font-size:0.88rem;color:var(--color-body);line-height:1.5 }
    .catalog { padding:5.5rem 0;background:#fff }
    .catalog-header { display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:2.5rem;gap:1.5rem;flex-wrap:wrap }
    .catalog-title-group h2 { font-family:var(--font-display);font-size:clamp(1.8rem,3vw,2.4rem);color:var(--color-charcoal);font-weight:700;line-height:1.2 }
    .catalog-title-group p { font-size:0.95rem;color:var(--color-body);margin-top:0.3rem }
    .catalog-controls { display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap }
    .search-wrap { position:relative }
    .search-wrap input { border:1.5px solid var(--color-border);border-radius:50px;padding:0.6rem 1rem 0.6rem 2.6rem;font-size:0.9rem;font-family:var(--font-ui);width:220px;outline:none;transition:var(--transition);background:var(--color-bg) }
    .search-wrap input:focus { border-color:var(--color-primary);background:#fff;box-shadow:0 0 0 3px rgba(136,173,53,0.15) }
    .search-icon { position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:var(--color-border);font-size:0.95rem;pointer-events:none }
    .filter-select { border:1.5px solid var(--color-border);border-radius:50px;padding:0.6rem 2rem 0.6rem 1rem;font-size:0.9rem;font-family:var(--font-ui);background:var(--color-bg);outline:none;cursor:pointer;transition:var(--transition) }
    .filter-select:focus { border-color:var(--color-primary) }
    .product-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.75rem }
    .product-skeleton { height:360px;border-radius:var(--radius);background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.3s infinite }
    @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
    .load-more-row { text-align:center;margin-top:3.5rem }
    .btn-load-more { background:transparent;border:2px solid var(--color-primary);color:var(--color-primary);padding:0.85rem 2.8rem;border-radius:50px;font-size:0.95rem;font-weight:600;transition:var(--transition) }
    .btn-load-more:hover { background:var(--color-primary);color:#fff }
    .empty-state { text-align:center;padding:4rem 0;color:var(--color-body) }
    .empty-icon { font-size:3rem;margin-bottom:1rem }
    .site-footer { background:var(--color-charcoal);color:rgba(255,255,255,0.7);padding:2.5rem 0 0 }
    .footer-top { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1.5rem;padding-bottom:1.75rem;border-bottom:1px solid rgba(255,255,255,0.08) }
    .footer-bottom { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;padding:1rem 0 1.5rem }
    .footer-copy-small { font-size:0.78rem;color:rgba(255,255,255,0.35) }
    .footer-util-links { display:flex;gap:1rem;flex-wrap:wrap }
    .footer-util-btn { background:none;border:none;color:rgba(255,255,255,0.45);font-size:0.8rem;cursor:pointer;font-family:var(--font-ui);padding:0;transition:color 0.2s }
    .footer-util-btn:hover { color:var(--color-primary) }
    .footer-brand { display:flex;align-items:center;gap:0.75rem }
    .footer-brand img { width:38px;height:38px;border-radius:8px }
    .footer-brand-text strong { display:block;font-size:0.95rem;color:#fff;font-family:var(--font-display) }
    .footer-brand-text span { font-size:0.78rem }
    .footer-copy { font-size:0.82rem;text-align:center;max-width:340px }
    .footer-links { display:flex;gap:1.5rem;font-size:0.83rem }
    .footer-links a { color:rgba(255,255,255,0.7);text-decoration:none;transition:var(--transition) }
    .footer-links a:hover { color:var(--color-primary) }
    /* ── Footer modals ── */
    .ft-modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:1200;display:flex;align-items:center;justify-content:center;padding:1.5rem }
    .ft-modal { background:#fff;border-radius:18px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.25) }
    .ft-modal-wide { max-width:700px }
    .ft-modal-header { display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(0,0,0,0.07) }
    .ft-modal-header h3 { font-family:var(--font-display);font-size:1.15rem;color:var(--color-charcoal) }
    .ft-close { background:rgba(0,0,0,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:0.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center }
    .ft-close:hover { background:rgba(0,0,0,0.12) }
    .ft-modal-body { padding:1.25rem 1.5rem;overflow-y:auto;flex:1 }
    .ft-modal-footer { padding-top:1rem;display:flex;justify-content:flex-end }
    .ft-hint { font-size:0.85rem;color:var(--color-body);margin-bottom:0.75rem }
    .ft-empty { font-size:0.9rem;color:var(--color-body);text-align:center;padding:1rem 0 }
    .ft-prose { font-size:0.9rem;color:var(--color-body);line-height:1.75;white-space:pre-wrap }
    .ft-textarea { width:100%;border:1.5px solid var(--color-border);border-radius:10px;padding:0.75rem 1rem;font-size:0.9rem;font-family:var(--font-ui);outline:none;resize:vertical;box-sizing:border-box }
    .ft-textarea:focus { border-color:var(--color-primary) }
    .ft-btn-submit { background:var(--color-primary);color:#fff;border:none;padding:0.65rem 1.4rem;border-radius:50px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:var(--transition) }
    .ft-btn-submit:hover:not(:disabled) { background:var(--color-primary-d) }
    .ft-btn-submit:disabled { opacity:0.5;cursor:not-allowed }
    .ft-link { color:var(--color-primary);text-decoration:underline }
    .contact-socials { display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1rem }
    .social-link { display:flex;align-items:center;gap:0.6rem;color:var(--color-charcoal);text-decoration:none;font-size:0.92rem;padding:0.45rem 0;border-bottom:1px solid rgba(0,0,0,0.05);transition:color 0.2s }
    .social-link:hover { color:var(--color-primary) }
    .social-emoji { font-size:1.2rem;width:1.6rem;text-align:center }
    .contact-info-text { font-size:0.88rem;color:var(--color-body);line-height:1.7;white-space:pre-wrap;margin-top:0.5rem }
    @keyframes bounce { 0%,100% { transform:translateX(-50%) translateY(0) } 50% { transform:translateX(-50%) translateY(6px) } }
    @media (max-width:900px) { .feature-grid { grid-template-columns:1fr;gap:2.5rem } .feature-grid.reverse { direction:ltr } .feature-img-wrap { aspect-ratio:16/9 } .catalog-header { flex-direction:column;align-items:flex-start } }
    @media (max-width:600px) { .product-grid { grid-template-columns:1fr 1fr;gap:1rem } .manifesto blockquote { padding:0 1rem } .footer-top { flex-direction:column;align-items:center;text-align:center } .footer-bottom { flex-direction:column;align-items:center;text-align:center } .footer-links { justify-content:center;flex-wrap:wrap } }
    @media (max-width:420px) { .product-grid { grid-template-columns:1fr } .hero-content h1 { font-size:2rem } }
  `]
})
export class HomeComponent implements OnInit {
  private allProducts: ProductItem[] = [];

  searchQuery = '';
  selectedCategory = '';
  displayedCount = 8;
  categories: string[] = [];
  isLoading = true;
  skeletons = [1, 2, 3, 4, 5, 6, 7, 8];

  // Hero
  heroImages: string[] = [];
  heroBadge: string | null = null;
  heroHeading: string | null = null;
  heroSubheading: string | null = null;
  heroCopy: string | null = null;

  // Manifesto
  manifestoQuote: string | null = null;

  // Feature sections
  feature1Images: string[] = [];
  feature2Images: string[] = [];
  feature1Para1: string | null = null;
  feature2Para1: string | null = null;

  // Highlights
  highlightsEyebrow: string | null = null;
  highlightsTitle: string | null = null;
  highlightCards: HighlightCard[] = DEFAULT_HIGHLIGHTS;

  // Footer
  footerLogoSrc = '/assets/Artistry-Giftopia-300x300.png';
  footerBrandName = 'Kalakaari Gifting';
  footerBrandTagline = 'Where Creativity Becomes a Gift';
  footerCopy = 'Curating smiles and celebrating sweet connections since 2024. Made locally with love. 💚';
  footerLinkCatalog = 'Browse Catalog';
  footerLinkStory = 'Our Story';
  year = new Date().getFullYear();

  // Footer modals
  openModalKey: string | null = null;
  termsContent: string | null = null;
  contactContent: string | null = null;

  // Social links (now from socialLinks$ observable)
  contactSocials: { icon: string; name: string; url: string }[] = [];

  constructor(
    private state: AppStateService,
    private cdr: ChangeDetectorRef,
    private telemetry: TelemetryService
  ) {}

  ngOnInit(): void {
    // Products subscription
    this.state.products$.subscribe(products => {
      this.allProducts = products;
      if (this.state.productsLoaded || products.length === 0) {
        this.isLoading = false;
      }
      this.categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
      this.displayedCount = 8;
      this.cdr.markForCheck();
    });

    // Site content subscription
    this.state.siteContent$.subscribe(items => {
      this.heroImages     = this.buildImageUrls(items, 'hero');
      this.feature1Images = this.buildImageUrls(items, 'feature-1');
      this.feature2Images = this.buildImageUrls(items, 'feature-2');

      this.heroBadge      = this.getText(items, 'hero.badge');
      this.heroHeading    = this.getText(items, 'hero.heading');
      this.heroSubheading = this.getText(items, 'hero.subheading');
      this.heroCopy       = this.getText(items, 'hero.copy');
      this.manifestoQuote = this.getText(items, 'manifesto.quote');
      this.feature1Para1  = this.getText(items, 'feature-1.para1');
      this.feature2Para1  = this.getText(items, 'feature-2.para1');

      this.highlightsEyebrow = this.getText(items, 'highlights.eyebrow');
      this.highlightsTitle   = this.getText(items, 'highlights.title');

      const cardItems = items
        .filter(i => i.contentKey.startsWith('highlights.card.') && i.kind === 'Text' && i.textValue)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (cardItems.length > 0) {
        this.highlightCards = cardItems.map(i => {
          try {
            return JSON.parse(i.textValue!) as HighlightCard;
          } catch {
            return { icon: '✨', title: i.contentKey, body: i.textValue ?? '' };
          }
        });
      } else {
        this.highlightCards = DEFAULT_HIGHLIGHTS;
      }

      const footerImages = items
                                .filter(i => i.sectionName === 'footer' && i.kind === 'Image' )
                                .sort((a,b) => a.sortOrder - b.sortOrder);
      if (footerImages.length > 0 && footerImages[0].imageUrl){
        this.footerLogoSrc = resolveSiteImageUrl(footerImages[0].imageUrl);
      }

      // Footer text fields
      this.footerBrandName    = this.getText(items, 'footer.brandName')    ?? 'Kalakaari Gifting';
      this.footerBrandTagline = this.getText(items, 'footer.brandTagline') ?? 'Where Creativity Becomes a Gift';
      this.footerCopy         = this.getText(items, 'footer.copy')         ?? 'Curating smiles and celebrating sweet connections since 2024. Made locally with love. 💚';
      this.footerLinkCatalog  = this.getText(items, 'footer.linkCatalog')  ?? 'Browse Catalog';
      this.footerLinkStory    = this.getText(items, 'footer.linkStory')    ?? 'Our Story';
      this.termsContent       = this.getText(items, 'footer.terms');
      this.contactContent     = this.getText(items, 'footer.contact.info');
      // reportEmail and contactSocials from siteContent removed

      this.cdr.markForCheck();
    });

    // Social links subscription (new)
    this.state.socialLinks$.subscribe(links => {
      this.contactSocials = links; // links array with { icon, name, url, ... }
      this.cdr.markForCheck();
    });



    // Fallback timeout
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  private buildImageUrls(items: SiteContentItem[], section: string): string[] {
    return items
      .filter(i => i.sectionName === section && i.kind === 'Image' && i.imageUrl)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(i => resolveSiteImageUrl(i.imageUrl));
  }

  private getText(items: SiteContentItem[], key: string): string | null {
    return items.find(i => i.contentKey === key && i.kind === 'Text')?.textValue ?? null;
  }

  get filteredProducts(): ProductItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.allProducts.filter(p => {
      const matchQuery = !q ||
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q);
      const matchCat = !this.selectedCategory || p.category === this.selectedCategory;
      return matchQuery && matchCat;
    });
  }

  get visibleProducts(): ProductItem[] {
    return this.filteredProducts.slice(0, this.displayedCount);
  }

  get hasMore(): boolean {
    return this.filteredProducts.length > this.displayedCount;
  }

  onSearch(v: string): void { 
    this.searchQuery = v; 
    this.displayedCount = 8; 
    if (v && v.trim().length> 0) {
      this.telemetry.trackUserAction('Someone searched for ' , v.trim());
    }
  }
  onFilter(v: string): void { this.selectedCategory = v; this.displayedCount = 8; this,this.telemetry.trackUserAction('Someone applied a filter with the category as :' , this.selectedCategory ?? 'unkown'); }
  loadMore(): void { this.displayedCount += 8; this.telemetry.trackUserAction('Someone loaded more products and set the displayed count to' , this.displayedCount.toString() ?? 'unkown');}
  trackById(_: number, p: ProductItem): string { return p.id; }
  scrollTo(id: string): void { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }

  openModal(key: string) { this.openModalKey = key; }
  closeModal() { this.openModalKey = null; }
}