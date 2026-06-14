import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// ── Environment / API base ─────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000';

// ── DTOs ───────────────────────────────────────────────────────────────────
export interface ProductImage {
  id: string;
  imageUrl: string;
  optimizedUrl: string; // f_auto,q_auto injected server-side
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductItem {
  id: string;
  title: string;
  price: string;       // formatted display string
  priceNum: number;    // raw number for calculations
  category: string;
  image: string;       // primary image optimized URL (for backward compat)
  images: ProductImage[];
  description?: string;
  shortDescription?: string;
}

/** 
 * SiteContentItem - returned by /api/content (public).
 * For Image items : imageUrl is either "api/content/{id}/image" (binary uploaded)
 * or the full external URL (Unsplash/Cloudinary seed) - both render in <img src>.
 * For Text items : textValue holds the copy.
 * Non-product section images served as binary from the DB */
export interface SiteContentItem {
  id: string;
  contentKey: string;
  sectionName: string;
  kind: 'Text' | 'Image';
  textValue?: string;
  mimeType?: string;
  displayLocation?: string;
  altText?: string;
  sortOrder: number;
  imageUrl?: string | null; // absolute external URL or /api/content/{id}/image
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
}

export interface OrderMessage {
  id: string;
  sender: string;
  messageText: string;
  createdAt: string;
}

export interface Order {
  id: string;
  publicOrderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
  deliveredAt?: string;
  items: OrderItem[];
  messages: OrderMessage[];
}

export interface OrderItem {
  id: string;
  productId: string;
  titleSnapshot: string;
  priceSnapshot: number;
  quantity: number;
}

// ── Helper: Cloudinary URL optimizer (client-side belt & suspenders) ───────
export function getOptimizedUrl(storedDbUrl: string): string {
  if (!storedDbUrl) return '';
  return storedDbUrl.includes('/upload/')
    ? storedDbUrl.replace('/upload/', '/upload/f_auto,q_auto/')
    : storedDbUrl;
}

/** Resolves a site content image url to something the <img> tag can use */
export function resolveSiteImageUrl(imageUrl : string | null | undefined ): string {
  if (!imageUrl) return '';
  // Already a full http/https URL (UnSplash/Cloudinary external) -> use as-is
  if (imageUrl.startsWith('http')) return imageUrl;
  // Relative path from backend (binary blob) -> prefix with API base
  return `${API_BASE}${imageUrl}`;
}

// --- Loading Skeleton placeholder -------------
// Show a shimmer placeholder while the API responds. No more mock data in the UI.
const LOADING_PLACEHOLDER : ProductItem[] = [];


// ── Fallback mock data while backend is being set up ───────────────────────
const MOCK_PRODUCTS: ProductItem[] = [
  { id: 'p1', title: 'Minimalist Leather Wallet', price: '₹2,499', priceNum: 2499, category: 'Accessories', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=1000&auto=format&fit=crop', images: [], description: 'A hand-stitched bifold leather wallet crafted from full-grain vegetable-tanned leather.' },
  { id: 'p2', title: 'Handwoven Keychain', price: '₹499', priceNum: 499, category: 'Accessories', image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1000&auto=format&fit=crop', images: [], description: 'A beautifully handwoven keychain made from premium cotton threads in earthy tones.' },
  { id: 'p3', title: 'Ceramic Mug — Slate', price: '₹799', priceNum: 799, category: 'Kitchen', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop', images: [], description: 'Thrown by hand and finished with a signature slate-grey reactive glaze.' },
  { id: 'p4', title: 'Wooden Photo Frame', price: '₹1,199', priceNum: 1199, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop', images: [], description: 'Handcrafted solid-wood photo frame made from reclaimed teakwood.' },
  { id: 'p5', title: 'Handmade Notebook', price: '₹599', priceNum: 599, category: 'Stationery', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=1000&auto=format&fit=crop', images: [], description: 'A hand-bound journal with a textured linen cover in sage green.' },
  { id: 'p6', title: 'Minimal Pendant', price: '₹1,199', priceNum: 1199, category: 'Jewellery', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1000&auto=format&fit=crop', images: [], description: 'An elegantly minimal pendant hand-formed from recycled sterling silver.' },
  { id: 'p7', title: 'Soy Wax Candle Set', price: '₹1,450', priceNum: 1450, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=1000&auto=format&fit=crop', images: [], description: 'A set of three hand-poured soy wax candles with wooden wicks.' },
  { id: 'p8', title: 'Glass Vase — Botanical', price: '₹1,850', priceNum: 1850, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?q=80&w=1000&auto=format&fit=crop', images: [], description: 'A striking hand-blown glass vase with subtle botanical-green tones.' },
];

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly STORAGE_KEY = '__order_bag';
  private isBrowser: boolean;

  // ── Products (loaded from API, fall back to mock) ──────────────────────
  private productsSubject = new BehaviorSubject<ProductItem[]>(LOADING_PLACEHOLDER);
  products$ = this.productsSubject.asObservable();
  productsLoaded = false ; // true once at least one successful fetch completes.

  // ── Site content items (section images + text from DB) ──────────────────
  private siteContentSubject = new BehaviorSubject<SiteContentItem[]>([]);
  siteContent$ = this.siteContentSubject.asObservable();

  // ── Product detail drawer ──────────────────────────────────────────────
  private selectedProductSubject = new BehaviorSubject<ProductItem | null>(null);
  selectedProduct$ = this.selectedProductSubject.asObservable();

  // ── Cart ───────────────────────────────────────────────────────────────
  private cartSubject!: BehaviorSubject<CartItem[]>;
  cart$!: Observable<CartItem[]>;

  private cartOpenSubject = new BehaviorSubject<boolean>(false);
  cartOpen$ = this.cartOpenSubject.asObservable();

  // ── Track order modal ──────────────────────────────────────────────────
  private trackModalSubject = new BehaviorSubject<{ open: boolean; orderNumber?: string }>({ open: false });
  trackModal$ = this.trackModalSubject.asObservable();

  private socialLinksSubject = new BehaviorSubject<any[]>([]);
  socialLinks$ = this.socialLinksSubject.asObservable();
  private paymentDetailsSubject = new BehaviorSubject<any[]>([]);
  paymentDetails$ = this.paymentDetailsSubject.asObservable();

  private orders: Order[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    const initialCart = this.loadFromStorage();
    this.cartSubject = new BehaviorSubject<CartItem[]>(initialCart);
    this.cart$ = this.cartSubject.asObservable();

    
      // Load real data from the API on boot from db.
      this.loadProducts();
      this.loadSiteContent();

  }
  loadSocialLinks() {
    this.http.get<any[]>(`${API_BASE}/api/social-links`).pipe(
      tap(links => this.socialLinksSubject.next(links)),
      catchError(() => of([]))
    ).subscribe();
  }
  loadPaymentDetails() {
    this.http.get<any[]>(`${API_BASE}/api/payment-details`).pipe(
      tap(details => this.paymentDetailsSubject.next(details)),
      catchError(() => of([]))
    ).subscribe();
  }

  // ── Public data loaders ────────────────────────────────────────────────

  loadProducts(): void {
    this.http.get<any[]>(`${API_BASE}/api/products`).pipe(
      tap(raw => {
        const mapped: ProductItem[] = raw.map(p => {
          const primaryImg = (p.images ?? []).find((i: any) => i.isPrimary)
            ?? (p.images ?? [])[0];
          return {
            id: p.id,
            title: p.title,
            price: `₹${Number(p.price).toLocaleString('en-IN')}`,
            priceNum: Number(p.price),
            category: p.categoryName ?? '',
            image: primaryImg?.optimizedUrl ?? primaryImg?.imageUrl ?? '',
            images: (p.images ?? []).map((i: any) => ({
              id: i.id,
              imageUrl: i.imageUrl,
              optimizedUrl: i.optimizedUrl ?? getOptimizedUrl(i.imageUrl),
              altText: i.altText,
              isPrimary: i.isPrimary,
              sortOrder: i.sortOrder
            })),
            description: p.description,
            shortDescription: p.shortDescription
          };
        });
        this.productsLoaded = true;
        this.productsSubject.next(mapped);
      }),
      catchError(() => {
        //Backend not running yet - empty array so the UI shows "no products"
        // Keep mock data on error (API not yet running)
        this.productsSubject.next([]);
        return of(null);
      })
    ).subscribe();
  }

  loadSiteContent(): void {
    this.http.get<SiteContentItem[]>(`${API_BASE}/api/content`).pipe(
      tap(items => this.siteContentSubject.next(items)),
      catchError(() => of(null))
    ).subscribe();
  }

  getProducts(): ProductItem[] { return this.productsSubject.value; }
  getSiteContent(): SiteContentItem[] { return this.siteContentSubject.value; }

  /** Returns the image URLs for a given section, sorted by sortOrder. */
  getSectionImages(sectionName: string): string[] {
    return this.siteContentSubject.value
      .filter(i => i.sectionName === sectionName && i.kind === 'Image' && i.imageUrl)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(i => resolveSiteImageUrl(i.imageUrl));
  }

  /** Returns a text value for a given contentKey. */
  getTextContent(contentKey: string): string | null {
    const item = this.siteContentSubject.value.find(i => i.contentKey === contentKey && i.kind === 'Text');
    return item?.textValue ?? null;
  }

  // ── Cart helpers ───────────────────────────────────────────────────────
  private loadFromStorage(): CartItem[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveToStorage(cart: CartItem[]) {
    if (!this.isBrowser) return;
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }

  openProduct(p: ProductItem) { this.selectedProductSubject.next(p); }
  closeProduct() { this.selectedProductSubject.next(null); }

  addToCart(product: ProductItem, qty = 1) {
    const cart = this.cartSubject.value.slice();
    const idx = cart.findIndex(c => c.product.id === product.id);
    if (idx >= 0) cart[idx].quantity += qty; else cart.push({ product, quantity: qty });
    this.cartSubject.next(cart);
    this.saveToStorage(cart);
    this.cartOpenSubject.next(true);
    this.selectedProductSubject.next(null);
  }

  removeFromCart(productId: string) {
    const cart = this.cartSubject.value.filter(c => c.product.id !== productId);
    this.cartSubject.next(cart);
    this.saveToStorage(cart);
  }

  clearCart() {
    this.cartSubject.next([]);
    if (this.isBrowser) { try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ } }
  }

  openCart() { this.cartOpenSubject.next(true); }
  hideCart() { this.cartOpenSubject.next(false); }
  /* showTrackModal() { this.trackModalSubject.next(true); }
  hideTrackModal() { this.trackModalSubject.next(false); } */
  showTrackModal(orderNumber?: string) {
    this.trackModalSubject.next({ open: true, orderNumber });
  }

  hideTrackModal() {
    this.trackModalSubject.next({ open: false });
  }

  /* createOrder(customer_name: string, customer_phone: string, customer_address: string): Order {
    const items = this.cartSubject.value.slice();
    const currentYear : string = new Date().getFullYear().toString();
    const id = `ORD-${currentYear}-` + Math.random().toString(36).slice(2, 8).toUpperCase();
    const order: Order = {
      id, customer_name, customer_phone, customer_address, items,
      status: 'Pending Payment', created_at: new Date().toISOString(),
      messages: [{ id: 'm1', sender: 'system', message_text: 'Order placed', created_at: new Date().toISOString() }]
    };
    this.orders.push(order);
    this.clearCart();
    return order;
  } */

     // ── Order API ────────────────────────────────────────────────────────

    createOrder(
      customerName: string,
      customerPhone: string,
      customerAddress: string,
      paymentMethod: string,
      transactionId?: string
    ): Observable<{ publicOrderNumber: string }> {
      const items = this.cartSubject.value.map(c => ({
        productId: c.product.id,
        quantity: c.quantity
      }));
      return this.http.post<{ publicOrderNumber: string }>(`${API_BASE}/api/orders`, {
        customerName,
        customerPhone,
        customerAddress,
        items,
        paymentMethod,
        transactionId
      }).pipe(
        tap(() => this.clearCart())
      );
    }

  getOrderByNumber(orderNumber: string): Observable<Order> {
    return this.http.get<Order>(`${API_BASE}/api/orders/${orderNumber}`);
  }

  /* findOrderById(id: string) { return this.orders.find(o => o.id === id) ?? null; }
  findOrdersByPhone(phone: string) { return this.orders.filter(o => o.customerPhone === phone); }
 */

  findOrderByPhone(phone : string) : Observable<Order[]>{
    return this.http.get<Order[]>(`${API_BASE}/api/orders/by-phone/${phone}`);
  }

  // To download an Invoice PDF which returns a blob
  getOrderInvoice(orderNumber: string): Observable<Blob> {
  return this.http.get(`${API_BASE}/api/orders/${orderNumber}/invoice`, {
    responseType: 'blob'
  });
}
  /* addMessage(orderId: string, sender: string, text: string) {
    const order = this.findOrderById(orderId);
    if (!order) return null;
    const msg: OrderMessage = { id: Math.random().toString(36).slice(2, 8), sender, message_text: text, created_at: new Date().toISOString() };
    order.messages.push(msg);
    return msg;
  } */

  addOrderMessageByNumber(orderNumber: string, text: string): Observable<OrderMessage> {
    return this.http.post<OrderMessage>(`${API_BASE}/api/orders/${orderNumber}/messages`, {
      messageText: text
    });
  }

}