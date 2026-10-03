import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { AppStateService, Order, resolveSiteImageUrl } from '../services/app-state.service';

@Component({
  selector: 'app-track-order-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div id="track-modal" [class.active]="open">
      <div class="modal-overlay" (click)="close()"></div>
      <div class="track-card">
        <button class="modal-close-btn" type="button" (click)="close()">✕</button>
        <h3>Track Your Order</h3>

        <!-- ── Search form (shown when no results yet) ── -->
        @if (orders().length === 0 && !order()) {
          <!-- Tab bar -->
          <div class="tabs-row">
            <button class="tab-btn"
                    [class.active-tab]="activeTab() === 'order'"
                    (click)="activeTab.set('order')">
              Order ID
            </button>
            <button class="tab-btn"
                    [class.active-tab]="activeTab() === 'phone'"
                    (click)="activeTab.set('phone')">
              Phone Number
            </button>
            <!-- Info icon (always visible while search form is shown) -->
            <span class="info-icon-wrapper" (click)="infoOpen.set(!infoOpen())" title="How search works">
              <span class="info-icon">ℹ️</span>
            </span>
          </div>

          <!-- Info tooltip -->
          @if (infoOpen()) {
            <div class="info-tooltip">
              <strong>Search preference:</strong><br>
              If you provide <strong>both</strong> Order ID and Phone Number, the system will first try to look up your Order ID. If that doesn’t match any order, it will automatically fall back to a phone number search. If neither works, you’ll see a “not found” message.
            </div>
          }

          <!-- Order ID input (only when active tab = order) -->
          @if (activeTab() === 'order') {
            <div class="track-input-field">
              <label class="track-input-label" for="track-order-id">Order ID</label>
              <input id="track-order-id"
                     [value]="orderIdInput()"
                     (input)="onOrderIdInput($any($event.target).value)"
                     (keyup.enter)="lookup()"
                     placeholder="e.g. ORD-2026-X8B9" />
              @if (orderIdError()) {
                <p class="field-error-msg">{{ orderIdError() }}</p>
              }
            </div>
          }

          <!-- Phone input (only when active tab = phone) -->
          @if (activeTab() === 'phone') {
            <div class="track-input-field">
              <label class="track-input-label" for="track-phone">Phone Number</label>
              <input id="track-phone"
                     [value]="phoneInput()"
                     (input)="onPhoneInput($any($event.target).value)"
                     (keyup.enter)="lookup()"
                     inputmode="numeric"
                     maxlength="10"
                     placeholder="10-digit mobile number" />
              @if (phoneError()) {
                <p class="field-error-msg">{{ phoneError() }}</p>
              }
            </div>
          }

          <button class="btn-track-search" (click)="lookup()">Search</button>
          @if (searchError()) {
            <p class="error-msg">{{ searchError() }}</p>
          }
        }

        <!-- ── Multiple orders found by phone ── -->
        @if (orders().length > 1 && !order()) {
          <div class="results-header">
            <span class="results-count">{{ orders().length }} orders found</span>
            <button class="btn-search-again" (click)="searchAgain()">← New Search</button>
          </div>
          <div class="orders-list">
            @for (o of orders(); track o.id) {
              <button class="order-list-item" type="button" (click)="selectOrder(o)">
                <div class="oli-left">
                  <span class="oli-number">{{ o.publicOrderNumber }}</span>
                  <span class="oli-date">{{ o.createdAt | date:'d MMM yyyy' }}</span>
                </div>
                <div class="oli-right">
                  <span class="oli-badge" [ngClass]="statusBadgeClass(o)">{{ statusLabel(o) }}</span>
                  <span class="oli-arrow">›</span>
                </div>
              </button>
            }
          </div>
        }

        <!-- ── Single order detail ── -->
        @if (order(); as ord) {
          <div class="track-result show">
            @if (orders().length > 1) {
              <button class="btn-search-again" (click)="backToList()">← All Orders</button>
            } @else {
              <button class="btn-search-again" (click)="searchAgain()">← New Search</button>
            }

            <div class="track-result-header">
              <div class="track-order-id">
                <strong>{{ ord.publicOrderNumber }}</strong><br/>
                {{ ord.createdAt | date:'d MMMM yyyy' }} · {{ ord.customerName }}
              </div>
              <span class="track-status-badge" [ngClass]="statusBadgeClass(ord)">
                {{ statusLabel(ord) }}
              </span>
            </div>

            @if (ord.paymentStatus === 'Failed') {
              <div class="payment-failed-banner">
                ⚠️ Payment marked as <strong>Failed</strong> by the store. Please contact us to resolve this.
              </div>
            }

            <div class="track-timeline">
              <div class="track-step done">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Order Placed</div>
              </div>
              <div class="track-step"
                   [class.done]="isPaymentVerified(ord)"
                   [class.failed]="ord.paymentStatus === 'Failed'">
                <div class="track-step-dot"></div>
                <div class="track-step-label">{{ ord.paymentStatus === 'Failed' ? 'Payment Failed' : 'Payment Verified' }}</div>
              </div>
              <div class="track-step" [class.done]="isPacked(ord)">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Packed</div>
              </div>
              <div class="track-step" [class.done]="isDispatched(ord)">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Dispatched</div>
              </div>
              <div class="track-step" [class.done]="ord.status === 'Delivered'">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Delivered</div>
              </div>
            </div>

            @if (ord.status === 'PendingPayment' && ord.paymentStatus !== 'Failed' && paymentQrImages().length > 0) {
              <div class="payment-section">
                <h4>Complete Your Payment</h4>
                <p>Scan any of the QR codes below with your UPI app.</p>
                <div class="qr-gallery">
                  @for (img of paymentQrImages(); track img) {
                    <img [src]="img" alt="Payment QR" class="qr-image" />
                  }
                </div>
              </div>
            }

            <div class="timeline-messages">
              @for (msg of ord.messages; track msg.id) {
                <div class="msg">
                  <strong>{{ msg.sender }}</strong>: {{ msg.messageText }}
                </div>
              }
            </div>

            <div class="note-row">
              <input #noteInput placeholder="Type a note to the owner..."
                     (keyup.enter)="sendNote(noteInput.value); noteInput.value = ''" />
              <button class="btn-note" (click)="sendNote(noteInput.value); noteInput.value = ''">Send Note</button>
            </div>

            <div class="invoice-row">
              <button class="btn-invoice" type="button" (click)="downloadInvoice(ord)" [disabled]="downloadingInvoice()">
                @if (downloadingInvoice()) { 📄 Preparing… } @else { 📄 Download Invoice (PDF) }
              </button>
              @if (invoiceError()) { <p class="field-error-msg">{{ invoiceError() }}</p> }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host{position:fixed;inset:0;z-index:800;pointer-events:none}
    #track-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;pointer-events:none;transition:opacity 0.3s}
    #track-modal.active{opacity:1;pointer-events:auto}
    .modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)}
    .track-card{position:relative;z-index:1;background:#fff;border-radius:20px;padding:2rem 2rem 2.5rem;max-width:540px;width:100%;box-shadow:0 24px 64px rgba(34,34,34,0.2);transform:translateY(20px);transition:transform 0.3s;max-height:90vh;overflow-y:auto}
    #track-modal.active .track-card{transform:translateY(0)}
    .track-card h3{font-family:var(--font-display);font-size:1.4rem;color:var(--color-charcoal);margin-bottom:0.3rem}
    .track-sub{font-size:0.88rem;color:var(--color-body);margin-bottom:1rem}

    /* ── Tabs ── */
    .tabs-row { display: flex; gap: 0; margin-bottom: 1.25rem; align-items: center; }
    .tab-btn {
      flex: 1;
      background: #f4f4f4;
      border: none;
      padding: 0.7rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      font-family: var(--font-ui);
      cursor: pointer;
      text-align: center;
      color: #888;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
      outline: none;
    }
    .tab-btn:first-child { border-radius: 12px 0 0 12px; }
    .tab-btn:last-child { border-radius: 0 12px 12px 0; }
    .tab-btn.active-tab {
      background: white;
      color: var(--color-primary-d);
      border-bottom-color: var(--color-primary);
      box-shadow: 0 0 12px rgba(136,173,53,0.5), 0 0 24px rgba(136,173,53,0.25);
      z-index: 1;
      position: relative;
    }
    .tab-btn.active-tab::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 2px;
      background: var(--color-primary);
      border-radius: 2px;
    }
    .tab-btn:not(.active-tab):hover {
      color: var(--color-charcoal);
      background: #eaeaea;
    }

    /* Info icon */
    .info-icon-wrapper {
      margin-left: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .info-icon {
      font-size: 1.2rem;
      color: #aaa;
      transition: color 0.15s;
    }
    .info-icon-wrapper:hover .info-icon {
      color: var(--color-primary-d);
    }
    .info-tooltip {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 0.8rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.8rem;
      color: var(--color-body);
      line-height: 1.5;
    }

    /* ── Input fields ── */
    .track-input-field { flex:1; min-width:140px; display:flex; flex-direction:column; gap:0.3rem; margin-bottom:0.5rem; }
    .track-input-label { font-size:0.78rem; font-weight:600; color:var(--color-charcoal); letter-spacing:0.02em; }
    .track-input-field input {
      width:100%;
      padding:0.7rem 1rem;
      border:1.5px solid var(--color-border);
      border-radius:var(--radius-sm);
      font-size:0.9rem;
      font-family:var(--font-ui);
      outline:none;
      transition:var(--transition);
      box-sizing:border-box;
    }
    .track-input-field input:focus { border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(136,173,53,0.12); }
    .btn-track-search{
      background:var(--color-primary); color:#fff; border:none; padding:0.7rem 1.3rem;
      border-radius:var(--radius-sm); font-weight:600; font-family:var(--font-ui);
      cursor:pointer; transition:var(--transition); height:42px; margin-top:0.75rem;
    }
    .btn-track-search:hover{background:var(--color-primary-d)}
    .error-msg{color:#e05454;font-size:0.85rem;margin-top:0.5rem}
    .field-error-msg{color:#e05454;font-size:0.78rem;margin:0.15rem 0 0}

    /* ── Multi-result list ── */
    .results-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem}
    .results-count{font-size:0.82rem;font-weight:600;color:var(--color-body)}
    .orders-list{display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.5rem}
    .order-list-item{display:flex;align-items:center;justify-content:space-between;width:100%;background:var(--color-sage);border:1.5px solid transparent;border-radius:12px;padding:0.9rem 1.1rem;cursor:pointer;text-align:left;transition:border-color 0.15s,background 0.15s;font-family:var(--font-ui)}
    .order-list-item:hover{border-color:var(--color-primary);background:rgba(136,173,53,0.08)}
    .oli-left{display:flex;flex-direction:column;gap:0.2rem}
    .oli-number{font-size:0.92rem;font-weight:700;color:var(--color-charcoal);font-family:monospace}
    .oli-date{font-size:0.78rem;color:var(--color-body)}
    .oli-right{display:flex;align-items:center;gap:0.6rem}
    .oli-arrow{font-size:1.3rem;color:var(--color-border);line-height:1}

    /* ── Single order result ── */
    .track-result{background:var(--color-sage);border-radius:12px;padding:1.25rem;display:none}
    .track-result.show{display:block}
    .track-result-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:1rem;margin-top:0.75rem}
    .track-order-id{font-size:0.88rem;color:var(--color-body)}
    .track-order-id strong{color:var(--color-charcoal);font-size:1rem}
    .track-status-badge{padding:0.3rem 0.85rem;border-radius:50px;font-size:0.78rem;font-weight:600;white-space:nowrap;flex-shrink:0}
    .status-pending{background:rgba(245,158,11,0.15);color:#d97706}
    .status-verified{background:rgba(136,173,53,0.15);color:var(--color-primary-d)}
    .status-failed{background:rgba(224,84,84,0.15);color:#e05454}
    .status-cancelled{background:rgba(100,100,100,0.15);color:#666}
    .payment-failed-banner{background:rgba(224,84,84,0.08);border:1.5px solid rgba(224,84,84,0.25);border-radius:10px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;font-size:0.84rem;color:#c0392b}
    .track-timeline{display:flex;justify-content:space-between;margin-top:1rem;position:relative;gap:0.5rem}
    .track-timeline::before{content:'';position:absolute;top:11px;left:8%;right:8%;height:2px;background:var(--color-border)}
    .track-step{text-align:center;position:relative;z-index:1;flex:1}
    .track-step-dot{width:22px;height:22px;border-radius:50%;background:var(--color-border);margin:0 auto 0.4rem;border:3px solid #fff;box-shadow:0 0 0 2px var(--color-border)}
    .track-step.done .track-step-dot{background:var(--color-primary);box-shadow:0 0 0 2px var(--color-primary)}
    .track-step.failed .track-step-dot{background:#e05454;box-shadow:0 0 0 2px #e05454}
    .track-step.failed .track-step-label{color:#e05454;font-weight:600}
    .track-step-label{font-size:0.67rem;color:var(--color-body);font-weight:500}
    .timeline-messages{margin-top:1rem;border-top:1px solid rgba(209,209,209,0.5);padding-top:0.75rem}
    .msg{font-size:0.86rem;color:var(--color-body);padding:0.2rem 0}
    .note-row{display:flex;gap:0.6rem;margin-top:1rem}
    .note-row input{flex:1;padding:0.7rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition)}
    .note-row input:focus{border-color:var(--color-primary)}
    .btn-note{background:var(--color-primary);color:#fff;border:none;padding:0.7rem 1rem;border-radius:var(--radius-sm);font-weight:600;font-family:var(--font-ui);cursor:pointer;transition:var(--transition)}
    .btn-note:hover{background:var(--color-primary-d)}
    .btn-search-again{display:inline-block;margin-bottom:0.5rem;background:none;border:none;color:var(--color-body);font-size:0.82rem;cursor:pointer;text-decoration:underline;padding:0;font-family:var(--font-ui)}
    .btn-search-again:hover{color:var(--color-charcoal)}
    .modal-close-btn{position:absolute;top:1.25rem;right:1.25rem;background:var(--color-bg);border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--transition)}
    .modal-close-btn:hover{background:var(--color-border)}
    .payment-section{margin:1rem 0;padding:1rem;background:rgba(136,173,53,0.06);border-radius:12px}
    .payment-section h4{font-size:0.88rem;font-weight:600;color:var(--color-charcoal);margin-bottom:0.3rem}
    .payment-section p{font-size:0.82rem;color:var(--color-body);margin-bottom:0.6rem}
    .qr-gallery{display:flex;gap:10px;flex-wrap:wrap}
    .qr-image{width:120px;height:120px;object-fit:contain;border:1px solid var(--color-border);border-radius:8px}
    .oli-badge{padding:0.25rem 0.7rem;border-radius:50px;font-size:0.74rem;font-weight:600;white-space:nowrap}
    .invoice-row{margin-top:1rem;border-top:1px solid rgba(209,209,209,0.5);padding-top:0.85rem}
    .btn-invoice{width:100%;background:#fff;color:var(--color-charcoal);border:1.5px solid var(--color-border);padding:0.7rem 1rem;border-radius:var(--radius-sm);font-weight:600;font-family:var(--font-ui);cursor:pointer;transition:var(--transition)}
    .btn-invoice:hover:not(:disabled){border-color:var(--color-primary);color:var(--color-primary)}
    .btn-invoice:disabled{opacity:0.6;cursor:not-allowed}

    /* Responsive tabs */
    @media (max-width:600px){
      .track-card{padding:1.5rem}
      .tabs-row { flex-wrap: wrap; }
      .tab-btn { flex-basis: 100%; border-radius: 12px !important; margin-bottom:0.25rem; }
      .info-icon-wrapper { margin-left: 0; width: 100%; text-align: right; }
      .track-input-group,.note-row{flex-direction:column}
      .btn-track-search{align-self:stretch}
      .track-timeline{flex-wrap:wrap}
      .track-timeline::before{left:12%;right:12%}
    }
  `]
})
export class TrackOrderModalComponent implements OnInit {
  open = false;
  orders = signal<Order[]>([]);
  order = signal<Order | null>(null);
  searchError = signal('');
  paymentQrImages = signal<string[]>([]);

  // ── Tab state ──
  activeTab = signal<'order' | 'phone'>('order');
  orderIdInput = signal('');
  phoneInput = signal('');
  infoOpen = signal(false);

  // Field-level validation errors
  orderIdError = signal('');
  phoneError = signal('');

  downloadingInvoice = signal(false);
  invoiceError = signal('');

  private static readonly PHONE_REGEX = /^\d{10}$/;
  private static readonly ORDER_ID_REGEX = /^ORD-\d{4}-[A-Za-z0-9]{6}$/;

  constructor(private state: AppStateService) {}

  ngOnInit() {
    this.state.trackModal$.subscribe(val => {
      this.open = val.open;
      if (val.open && val.orderNumber) {
        this.fetchOrder(val.orderNumber);
      } else if (!val.open) {
        this.reset();
      }
    });

    this.state.siteContent$.subscribe(items => {
      const urls = items
        .filter(i => i.sectionName === 'payment-qr' && i.kind === 'Image' && i.imageUrl)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(i => resolveSiteImageUrl(i.imageUrl!));
      this.paymentQrImages.set(urls);
    });
  }

  close() { this.state.hideTrackModal(); }

  private reset() {
    this.orders.set([]);
    this.order.set(null);
    this.searchError.set('');
    this.orderIdInput.set('');
    this.phoneInput.set('');
    this.phoneError.set('');
    this.orderIdError.set('');
    this.invoiceError.set('');
    this.activeTab.set('order');
    this.infoOpen.set(false);
  }

  searchAgain() { this.reset(); }

  backToList() { this.order.set(null); }

  selectOrder(o: Order) { this.order.set(o); }

  // ── Input validation (real‑time) ──────────────────────────────────────
  onOrderIdInput(value: string) {
    this.orderIdInput.set(value.trim());
    this.validateOrderId();
  }

  onPhoneInput(value: string) {
    // Allow only digits (while typing)
    const digits = value.replace(/\D/g, '');
    this.phoneInput.set(digits);
    this.validatePhone();
  }

  private validateOrderId() {
    const val = this.orderIdInput();
    if (!val) { this.orderIdError.set(''); return; }
    if (!TrackOrderModalComponent.ORDER_ID_REGEX.test(val.toUpperCase())) {
      this.orderIdError.set('Order ID should look like ORD-2026-X8B9.');
    } else {
      this.orderIdError.set('');
    }
  }

  private validatePhone() {
    const val = this.phoneInput();
    if (!val) { this.phoneError.set(''); return; }
    if (!TrackOrderModalComponent.PHONE_REGEX.test(val)) {
      this.phoneError.set('Phone number must be exactly 10 digits.');
    } else {
      this.phoneError.set('');
    }
  }

  // ── Search logic (with fallback) ──────────────────────────────────────
  lookup() {
    this.searchError.set('');
    // Validate the active field
    if (this.activeTab() === 'order') {
      this.validateOrderId();
      if (this.orderIdError()) return;
    } else {
      this.validatePhone();
      if (this.phoneError()) return;
    }

    const hasId = !!this.orderIdInput() && !this.orderIdError();
    const hasPhone = !!this.phoneInput() && !this.phoneError();

    if (!hasId && !hasPhone) {
      this.searchError.set('Please provide a valid Order ID or phone number.');
      return;
    }

    if (hasId) {
      // Try Order ID first, fallback to phone
      this.orders.set([]);
      this.state.getOrderByNumber(this.orderIdInput().toUpperCase()).subscribe({
        next: o => { this.order.set(o); },
        error: () => {
          if (hasPhone) {
            this.searchByPhone(this.phoneInput());
          } else {
            this.searchError.set('Order not found. Check the ID and try again.');
          }
        }
      });
    } else {
      // Phone only
      this.searchByPhone(this.phoneInput());
    }
  }

  private searchByPhone(phone: string) {
    this.state.findOrderByPhone(phone).subscribe({
      next: raw => {
        if (!raw || raw.length === 0) {
          this.searchError.set('No orders found for that phone number.');
          return;
        }
        const sorted = [...raw].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (sorted.length === 1) {
          this.orders.set([]);
          this.order.set(sorted[0]);
        } else {
          this.orders.set(sorted);
          this.order.set(null);
        }
      },
      error: () => this.searchError.set('Could not search orders. Please try again.')
    });
  }

  fetchOrder(orderNumber: string) {
    this.searchError.set('');
    this.state.getOrderByNumber(orderNumber).subscribe({
      next: o => this.order.set(o),
      error: () => this.searchError.set('Order not found.')
    });
  }

  sendNote(text: string) {
    const ord = this.order();
    if (!ord || !text.trim()) return;
    this.state.addOrderMessageByNumber(ord.publicOrderNumber, text.trim()).subscribe({
      next: msg => this.order.update(o => o ? { ...o, messages: [...o.messages, msg] } : o),
      error: () => this.searchError.set('Could not send message.')
    });
  }

  downloadInvoice(ord: Order) {
    if (this.downloadingInvoice()) return;
    this.invoiceError.set('');
    this.downloadingInvoice.set(true);
    this.state.getOrderInvoice(ord.publicOrderNumber).subscribe({
      next: (blob) => {
        this.downloadingInvoice.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${ord.publicOrderNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingInvoice.set(false);
        this.invoiceError.set('Could not download invoice. Please try again.');
      }
    });
  }

  // ── Status helpers ──────────────────────────────────────────────────────
  statusLabel(o: Order): string {
    if (o.paymentStatus === 'Failed') return 'Payment Failed';
    if (o.status === 'Cancelled')     return 'Cancelled';
    if (o.status === 'Delivered')     return 'Delivered';
    if (o.status === 'Dispatched')    return 'Dispatched';
    if (o.status === 'Packed')        return 'Packed';
    if (o.status === 'PaymentVerified') return 'Payment Verified';
    return 'Pending Payment';
  }

  statusBadgeClass(o: Order): Record<string, boolean> {
    return {
      'status-failed':    o.paymentStatus === 'Failed',
      'status-cancelled': o.status === 'Cancelled',
      'status-verified':  !['PendingPayment','Cancelled'].includes(o.status) && o.paymentStatus !== 'Failed',
      'status-pending':   o.status === 'PendingPayment' && o.paymentStatus !== 'Failed',
    };
  }

  isPaymentVerified(o: Order): boolean {
    return ['PaymentVerified','Packed','Dispatched','Delivered'].includes(o.status);
  }
  isPacked(o: Order): boolean {
    return ['Packed','Dispatched','Delivered'].includes(o.status);
  }
  isDispatched(o: Order): boolean {
    return ['Dispatched','Delivered'].includes(o.status);
  }
}