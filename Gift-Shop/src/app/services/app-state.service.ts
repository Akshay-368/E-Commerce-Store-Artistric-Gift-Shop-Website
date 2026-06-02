import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ProductItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  category: string;
  image: string;
  description?: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
}

export interface OrderMessage { id: string; sender: string; message_text: string; created_at: string }

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: CartItem[];
  status: string;
  created_at: string;
  messages: OrderMessage[];
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly STORAGE_KEY = '__order_bag';
  private isBrowser: boolean;

  private products: ProductItem[] = [
    { id: 'p1', title: 'Minimalist Leather Wallet', price: '₹2,499', priceNum: 2499, category: 'Accessories', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=1000&auto=format&fit=crop', description: 'A hand-stitched bifold leather wallet crafted from full-grain vegetable-tanned leather.' },
    { id: 'p2', title: 'Handwoven Keychain', price: '₹499', priceNum: 499, category: 'Accessories', image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1000&auto=format&fit=crop', description: 'A beautifully handwoven keychain made from premium cotton threads in earthy tones.' },
    { id: 'p3', title: 'Ceramic Mug — Slate', price: '₹799', priceNum: 799, category: 'Kitchen', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop', description: 'Thrown by hand and finished with a signature slate-grey reactive glaze.' },
    { id: 'p4', title: 'Wooden Photo Frame', price: '₹1,199', priceNum: 1199, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop', description: 'Handcrafted solid-wood photo frame made from reclaimed teakwood.' },
    { id: 'p5', title: 'Handmade Notebook', price: '₹599', priceNum: 599, category: 'Stationery', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=1000&auto=format&fit=crop', description: 'A hand-bound journal with a textured linen cover in sage green.' },
    { id: 'p6', title: 'Minimal Pendant', price: '₹1,199', priceNum: 1199, category: 'Jewellery', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1000&auto=format&fit=crop', description: 'An elegantly minimal pendant hand-formed from recycled sterling silver.' },
    { id: 'p7', title: 'Soy Wax Candle Set', price: '₹1,450', priceNum: 1450, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=1000&auto=format&fit=crop', description: 'A set of three hand-poured soy wax candles with wooden wicks.' },
    { id: 'p8', title: 'Glass Vase — Botanical', price: '₹1,850', priceNum: 1850, category: 'Home Decor', image: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?q=80&w=1000&auto=format&fit=crop', description: 'A striking hand-blown glass vase with subtle botanical-green tones.' }
  ];

  private selectedProductSubject = new BehaviorSubject<ProductItem | null>(null);
  selectedProduct$ = this.selectedProductSubject.asObservable();

  private cartSubject!: BehaviorSubject<CartItem[]>;
  cart$ = null as unknown as import('rxjs').Observable<CartItem[]>;

  private cartOpenSubject = new BehaviorSubject<boolean>(false);
  cartOpen$ = this.cartOpenSubject.asObservable();

  private trackModalSubject = new BehaviorSubject<boolean>(false);
  trackModal$ = this.trackModalSubject.asObservable();

  private orders: Order[] = [];

  getProducts() { return this.products.slice(); }

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    const initialCart = this.loadFromStorage();
    this.cartSubject = new BehaviorSubject<CartItem[]>(initialCart);
    this.cart$ = this.cartSubject.asObservable();
  }

  private loadFromStorage(): CartItem[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading cart from storage', e);
      return [];
    }
  }

  private saveToStorage(cart: CartItem[]) {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Error writing cart to storage', e);
    }
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
    if (this.isBrowser) {
      try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) { /* ignore */ }
    }
  }

  openCart() { this.cartOpenSubject.next(true); }
  hideCart() { this.cartOpenSubject.next(false); }

  showTrackModal() { this.trackModalSubject.next(true); }
  hideTrackModal() { this.trackModalSubject.next(false); }

  createOrder(customer_name: string, customer_phone: string, customer_address: string) {
    const items = this.cartSubject.value.slice();
    const id = 'ORD-2026-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const order: Order = {
      id,
      customer_name,
      customer_phone,
      customer_address,
      items,
      status: 'Pending Payment',
      created_at: new Date().toISOString(),
      messages: [{ id: 'm1', sender: 'system', message_text: 'Order placed', created_at: new Date().toISOString() }]
    };
    this.orders.push(order);
    this.clearCart();
    return order;
  }

  findOrderById(id: string) { return this.orders.find(o => o.id === id) ?? null; }
  findOrdersByPhone(phone: string) { return this.orders.filter(o => o.customer_phone === phone); }

  addMessage(orderId: string, sender: string, text: string) {
    const order = this.findOrderById(orderId);
    if (!order) return null;
    const msg: OrderMessage = { id: Math.random().toString(36).slice(2,8), sender, message_text: text, created_at: new Date().toISOString() };
    order.messages.push(msg);
    return msg;
  }
}
