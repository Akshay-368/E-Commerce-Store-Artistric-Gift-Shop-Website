import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AppStateService, CartItem, resolveSiteImageUrl } from '../services/app-state.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drawer-overlay" [class.active]="open" (click)="close()"></div>
    <aside id="cart-drawer" class="cart" [class.open]="open">
      <div class="cart-header">
        <h3>🛍️ Your Order Bag</h3>
        <button class="drawer-close-btn" type="button" (click)="close()">✕</button>
      </div>
      <div class="cart-body">
        <ng-container *ngIf="!placedOrder && !orderPlacedSuccess; else placedState">
          <ng-container *ngIf="items.length > 0; else emptyState">
            <div class="cart-item" *ngFor="let item of items">
              <img [src]="item.product.image" [alt]="item.product.title" class="cart-item-img" />
              <div class="cart-item-info">
                <div class="cart-item-title">{{ item.product.title }}</div>
                <div class="cart-item-meta">Qty: {{ item.quantity }} · {{ item.product.category }}</div>
                <div class="cart-item-price">₹{{ (item.product.priceNum * item.quantity).toLocaleString('en-IN') }}</div>
              </div>
              <button class="cart-item-remove" type="button" (click)="remove(item.product.id)">✕</button>
            </div>

            <div class="cart-summary">
              <div class="cart-summary-row"><span>Subtotal</span><span>₹{{ total.toLocaleString('en-IN') }}</span></div>
              <div class="cart-summary-row"><span>Shipping</span><span class="free">Free</span></div>
              <div class="cart-summary-row total"><span>Total</span><span>₹{{ total.toLocaleString('en-IN') }}</span></div>
            </div>

            <!-- Payment QR Codes -->
            <div class="payment-qr-section" *ngIf="paymentQrImages().length > 0">
              <h4>Scan to pay with UPI</h4>
              <div class="qr-gallery">
                <img *ngFor="let img of paymentQrImages()" [src]="img" alt="Payment QR" class="qr-image" />
              </div>
            </div>

            <form class="checkout-section" (submit)="placeOrder($event)">
              <h4>Shipping Details</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Full Name</label>
                  <input name="name" required placeholder="Sahil Sharma" />
                </div>
                <div class="form-group">
                  <label>Phone Number</label>
                  <input name="phone" required placeholder="+91 98765 43210" />
                </div>
                <div class="form-group full">
                  <label>Delivery Address</label>
                  <textarea name="address" required placeholder="House no., Street, City, State, PIN"></textarea>
                </div>
              </div>

              <!-- Payment method selection -->
              <div class="payment-method-group">
                <label>Payment Method *</label>
                <div class="method-options">
                  <label class="method-option" [class.selected]="paymentMethod() === 'UPI'">
                    <input type="radio" name="paymentMethod" value="UPI" (change)="onMethodChange('UPI')" />
                    <span>UPI</span>
                  </label>
                  <label class="method-option" [class.selected]="paymentMethod() === 'Cash'">
                    <input type="radio" name="paymentMethod" value="Cash" (change)="onMethodChange('Cash')" />
                    <span>Cash</span>
                  </label>
                  <label class="method-option" [class.selected]="paymentMethod() === 'PayOnDelivery'">
                    <input type="radio" name="paymentMethod" value="PayOnDelivery" (change)="onMethodChange('PayOnDelivery')" />
                    <span>Pay on Delivery</span>
                  </label>
                </div>
              </div>

              <!-- Transaction ID (only for UPI) -->
              <div class="form-group" *ngIf="paymentMethod() === 'UPI'">
                <label>Transaction ID *</label>
                <input name="transactionId" required placeholder="Enter UPI reference number" />
              </div>

              <button class="btn-place-order" type="submit"
                [disabled]="submitting() || !paymentMethod() || (paymentMethod() === 'UPI' && !transactionId())">
                {{ submitting() ? 'Placing Order...' : '🎁 Submit & Place Order' }}
              </button>
              @if (error()) {
                <p class="error-msg">{{ error() }}</p>
              }
            </form>
          </ng-container>

          <ng-template #emptyState>
            <div class="cart-empty">
              <div class="cart-empty-icon">🛍️</div>
              <h4>Your bag is empty</h4>
              <p>Start adding beautiful handcrafted items to your order!</p>
              <button type="button" class="btn-place-order" (click)="browseCatalog()">Browse Collection</button>
            </div>
          </ng-template>
        </ng-container>

        <ng-template #placedState>
          <div class="order-placed show">
            <div class="order-placed-icon">🎉</div>
            <h4>Order Placed Successfully!</h4>
            <p class="placed-copy">Thank you, {{ placedOrder?.customerName }}! We've received your order.</p>
            <div class="order-id-box">
              <div class="order-id-label">Your Tracking ID</div>
              <div class="order-id-value">{{ placedOrder?.publicOrderNumber }}</div>
              <div class="order-id-hint">Save this — you'll need it to track your order</div>
            </div>
            <div class="upi-box">
              <h5>📲 Complete Your Payment</h5>
              <div class="upi-step">1. Open your UPI app (GPay, PhonePe, Paytm)</div>
              <div class="upi-step">2. Transfer <span class="upi-amount">₹{{ placedTotal.toLocaleString('en-IN') }}</span> to <strong>giftopia@upi</strong></div>
              <div class="upi-step">3. Our team will verify and ship your order within 24 hours</div>
              <button class="btn-place-order" (click)="trackOrder()">Track Your Order</button>
            </div>
          </div>
        </ng-template>
      </div>
    </aside>
  `,
  styles: [`
    :host{position:fixed;inset:0;pointer-events:none;z-index:900}
    .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity 0.3s}
    .drawer-overlay.active{opacity:1;pointer-events:auto}
    .cart{position:fixed;right:0;top:0;height:100vh;width:min(440px,100vw);background:#fff;overflow-y:auto;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.25,0.8,0.25,1);box-shadow:-12px 0 48px rgba(34,34,34,0.15);pointer-events:auto}
    .cart.open{transform:translateX(0)}
    .cart-header{position:sticky;top:0;background:#fff;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(209,209,209,0.4)}
    .cart-header h3{font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--color-charcoal)}
    .drawer-close-btn{background:var(--color-bg);border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .drawer-close-btn:hover{background:var(--color-border)}
    .cart-body{padding:1.25rem 1.5rem 1.5rem}
    .cart-empty{text-align:center;padding:3rem 1rem;color:var(--color-body)}
    .cart-empty-icon{font-size:3rem;margin-bottom:1rem}
    .cart-empty h4,.order-placed h4{font-family:var(--font-display);color:var(--color-charcoal)}
    .cart-empty h4{font-size:1.1rem}
    .cart-empty p{margin-top:0.5rem;font-size:0.88rem;color:var(--color-body)}
    .cart-item{display:flex;gap:1rem;padding:0.85rem 0;border-bottom:1px solid rgba(209,209,209,0.4);align-items:flex-start}
    .cart-item-img{width:60px;height:60px;border-radius:8px;object-fit:cover;background:var(--color-sage);flex-shrink:0}
    .cart-item-info{flex:1}
    .cart-item-title{font-size:0.9rem;font-weight:600;color:var(--color-charcoal);margin-bottom:0.2rem}
    .cart-item-meta{font-size:0.82rem;color:var(--color-body)}
    .cart-item-price{font-size:0.95rem;font-weight:700;color:var(--color-primary);margin-top:0.3rem}
    .cart-item-remove{background:none;border:none;color:var(--color-border);font-size:1.2rem;padding:0.1rem;transition:var(--transition)}
    .cart-item-remove:hover{color:#ef4444}
    .cart-summary{background:var(--color-bg);border-radius:var(--radius);padding:1rem 1.25rem;margin:1.25rem 0}
    .cart-summary-row{display:flex;justify-content:space-between;padding:0.3rem 0;font-size:0.9rem}
    .cart-summary-row.total{font-weight:700;font-size:1.05rem;color:var(--color-charcoal);border-top:1px solid var(--color-border);margin-top:0.5rem;padding-top:0.7rem}
    .free{color:var(--color-primary)}
    .payment-qr-section{margin-top:1rem;margin-bottom:1rem;padding:0.75rem;background:rgba(136,173,53,0.05);border-radius:10px}
    .payment-qr-section h4{font-family:var(--font-ui);font-size:0.85rem;color:var(--color-charcoal);margin-bottom:0.5rem}
    .qr-gallery{display:flex;gap:10px;flex-wrap:wrap}
    .qr-image{width:100px;height:100px;object-fit:contain;border:1px solid var(--color-border);border-radius:8px}
    .checkout-section{margin-top:1.5rem}
    .checkout-section h4{font-family:var(--font-ui);font-size:0.9rem;font-weight:600;color:var(--color-charcoal);margin-bottom:1rem;letter-spacing:0.04em;text-transform:uppercase}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem}
    .form-group{margin-bottom:0}
    .form-group.full{grid-column:1 / -1}
    .form-group label{display:block;font-size:0.8rem;font-weight:500;color:var(--color-body);margin-bottom:0.3rem}
    .form-group input,.form-group textarea{width:100%;padding:0.65rem 0.85rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition);background:#fff}
    .form-group input:focus,.form-group textarea:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px rgba(136,173,53,0.12)}
    .form-group textarea{resize:vertical;min-height:80px}
    .payment-method-group{margin-bottom:0.75rem}
    .payment-method-group label{display:block;font-size:0.8rem;font-weight:500;color:var(--color-body);margin-bottom:0.4rem}
    .method-options{display:flex;gap:0.5rem;flex-wrap:wrap}
    .method-option{display:flex;align-items:center;gap:0.3rem;padding:0.4rem 0.8rem;border:1.5px solid var(--color-border);border-radius:8px;cursor:pointer;font-size:0.85rem;transition:background 0.15s}
    .method-option:hover,.method-option.selected{background:rgba(136,173,53,0.08);border-color:var(--color-primary)}
    .method-option input{accent-color:var(--color-primary)}
    .btn-place-order{width:100%;padding:1rem;background:var(--color-primary);color:#fff;border:none;border-radius:50px;font-size:1rem;font-weight:600;transition:var(--transition);margin-top:1rem;box-shadow:0 4px 16px rgba(136,173,53,0.4)}
    .btn-place-order:hover{background:var(--color-primary-d)}
    .btn-place-order:disabled{opacity:0.5;cursor:not-allowed}
    .error-msg{color:#ef4444;font-size:0.85rem;margin-top:0.5rem}
    .order-placed{display:none;text-align:center;padding:1.5rem 0.5rem}
    .order-placed.show{display:block}
    .order-placed-icon{font-size:3.5rem;margin-bottom:1rem}
    .placed-copy{font-size:0.9rem;color:var(--color-body);margin-bottom:0.5rem}
    .order-id-box{background:var(--color-sage);border-radius:12px;padding:1rem;margin:1rem 0;font-family:var(--font-ui)}
    .order-id-label{font-size:0.78rem;color:var(--color-body);margin-bottom:0.3rem;font-weight:500}
    .order-id-value{font-size:1.2rem;font-weight:700;color:var(--color-primary);letter-spacing:0.04em}
    .order-id-hint{font-size:0.75rem;color:var(--color-body);margin-top:0.4rem}
    .upi-box{background:rgba(136,173,53,0.08);border:1.5px solid rgba(136,173,53,0.3);border-radius:12px;padding:1.25rem;margin-top:1rem;text-align:left}
    .upi-box h5{font-size:0.85rem;font-weight:600;color:var(--color-charcoal);margin-bottom:0.75rem}
    .upi-step{font-size:0.875rem;color:var(--color-body);padding:0.2rem 0;display:flex;gap:0.5rem}
    .upi-amount{font-size:1.1rem;font-weight:700;color:var(--color-primary)}
    @media (max-width:900px){.form-row{grid-template-columns:1fr}}
  `]
})
export class CartDrawerComponent {
  open = false;
  items: CartItem[] = [];
  placedOrder: any = null;
  placedTotal = 0;
  orderPlacedSuccess = false;
  submitting = signal(false);
  error = signal('');
  paymentMethod = signal<string>('');
  paymentQrImages = signal<string[]>([]);

  constructor(private state: AppStateService) {
    this.state.cart$.subscribe(items => {
      this.items = items;
      this.placedTotal = items.reduce((sum, item) => sum + item.product.priceNum * item.quantity, 0);
      if (items.length === 0 && !this.orderPlacedSuccess) {
        this.open = false;
      }
    });
    this.state.cartOpen$.subscribe(open => {
      this.open = open;
    });

    // Load payment QR images from site content
    this.state.siteContent$.subscribe(content => {
      const urls = content
        .filter(i => i.sectionName === 'payment-qr' && i.kind === 'Image' && i.imageUrl)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(i => resolveSiteImageUrl(i.imageUrl!));
      this.paymentQrImages.set(urls);
    });
  }

  close() {
    this.open = false;
    this.state.hideCart();
    if (!this.orderPlacedSuccess) {
      this.placedOrder = null;
    }
  }

  remove(productId: string) {
    this.state.removeFromCart(productId);
  }

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.product.priceNum * item.quantity, 0);
  }

  browseCatalog() {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    this.close();
  }

  onMethodChange(method: string) {
    this.paymentMethod.set(method);
  }

  transactionId() {
    // get from form
    return '';
  }

  placeOrder(e: Event) {
    e.preventDefault();
    if (this.submitting()) return;
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    const address = (form.elements.namedItem('address') as HTMLTextAreaElement).value.trim();
    const method = this.paymentMethod();
    let txnId: string | undefined;
    if (method === 'UPI') {
      txnId = (form.elements.namedItem('transactionId') as HTMLInputElement)?.value.trim();
      if (!txnId) {
        this.error.set('Transaction ID is required for UPI payment.');
        return;
      }
    }

    if (!name || !phone || !address) {
      this.error.set('All fields are required.');
      return;
    }
    if (!method) {
      this.error.set('Please select a payment method.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.state.createOrder(name, phone, address, method, txnId).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.placedOrder = {
          customerName: name,
          publicOrderNumber: res.publicOrderNumber
        };
        this.orderPlacedSuccess = true;
        this.state.showTrackModal(res.publicOrderNumber);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Failed to place order. Please try again.');
      }
    });
  }

  trackOrder() {
    if (this.placedOrder?.publicOrderNumber) {
      this.state.showTrackModal(this.placedOrder.publicOrderNumber);
    }
    this.close();
  }
}