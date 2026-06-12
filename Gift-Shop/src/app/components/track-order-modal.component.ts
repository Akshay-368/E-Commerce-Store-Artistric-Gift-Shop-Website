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

        @if (!order()) {
          <p>Enter your Order ID or phone number to check status.</p>
          <div class="track-input-group">
            <input #idInput placeholder="Order ID (e.g. ORD-2026-X8B9)" (keyup.enter)="lookup(idInput.value, phoneInput.value)" />
            <input #phoneInput placeholder="Or enter Phone Number" (keyup.enter)="lookup(idInput.value, phoneInput.value)" />
            <button class="btn-track-search" (click)="lookup(idInput.value, phoneInput.value)">Search</button>
          </div>
          @if (searchError()) {
            <p class="error-msg">{{ searchError() }}</p>
          }
        }

        @if (order(); as ord) {
          <div class="track-result show">
            <div class="track-result-header">
              <div class="track-order-id">
                <strong>{{ ord.publicOrderNumber }}</strong><br/>
                {{ ord.createdAt | date:'d MMMM yyyy' }} · {{ ord.customerName }}
              </div>
              <span class="track-status-badge" [class.status-pending]="ord.status === 'PendingPayment'" [class.status-verified]="ord.status !== 'PendingPayment'">
                {{ ord.status }}
              </span>
            </div>

            <!-- Timeline -->
            <div class="track-timeline">
              <div class="track-step done">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Order Placed</div>
              </div>
              <div class="track-step" [class.done]="ord.status !== 'PendingPayment'">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Payment Verified</div>
              </div>
              <div class="track-step" [class.done]="ord.status === 'Dispatched' || ord.status === 'Delivered'">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Dispatched</div>
              </div>
              <div class="track-step" [class.done]="ord.status === 'Delivered'">
                <div class="track-step-dot"></div>
                <div class="track-step-label">Delivered</div>
              </div>
            </div>

            <!-- Payment QR codes (if PendingPayment) -->
            @if (ord.status === 'PendingPayment' && paymentQrImages().length > 0) {
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

            <!-- Messages -->
            <div class="timeline-messages">
              @for (msg of ord.messages; track msg.id) {
                <div class="msg">
                  <strong>{{ msg.sender }}</strong>: {{ msg.messageText }}
                </div>
              }
            </div>

            <!-- Send note -->
            <div class="note-row">
              <input #noteInput placeholder="Type a note to the owner..." (keyup.enter)="sendNote(noteInput.value); noteInput.value = ''" />
              <button class="btn-note" (click)="sendNote(noteInput.value); noteInput.value = ''">Send Note</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `:host{position:fixed;inset:0;z-index:800;pointer-events:none}
    #track-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;pointer-events:none;transition:opacity 0.3s}
    #track-modal.active{opacity:1;pointer-events:auto}
    .modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)}
    .track-card{position:relative;z-index:1;background:#fff;border-radius:20px;padding:2rem 2rem 2.5rem;max-width:540px;width:100%;box-shadow:0 24px 64px rgba(34,34,34,0.2);transform:translateY(20px);transition:transform 0.3s;max-height:90vh;overflow-y:auto}
    #track-modal.active .track-card{transform:translateY(0)}
    .track-card h3{font-family:var(--font-display);font-size:1.4rem;color:var(--color-charcoal);margin-bottom:0.3rem}
    .track-input-group{display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:1.25rem}
    .track-input-group input{flex:1;min-width:140px;padding:0.7rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition)}
    .track-input-group input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px rgba(136,173,53,0.12)}
    .btn-track-search{background:var(--color-primary);color:#fff;border:none;padding:0.7rem 1.3rem;border-radius:var(--radius-sm);font-weight:600;transition:var(--transition)}
    .btn-track-search:hover{background:var(--color-primary-d)}
    .error-msg{color:#e05454;font-size:0.85rem;margin-top:0.5rem}
    .track-result{background:var(--color-sage);border-radius:12px;padding:1.25rem;display:none}
    .track-result.show{display:block}
    .track-result-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:1rem}
    .track-order-id{font-size:0.88rem;color:var(--color-body)}
    .track-order-id strong{color:var(--color-charcoal);font-size:1rem}
    .track-status-badge{padding:0.3rem 0.85rem;border-radius:50px;font-size:0.78rem;font-weight:600;white-space:nowrap}
    .status-pending{background:rgba(245,158,11,0.15);color:#d97706}
    .status-verified{background:rgba(136,173,53,0.15);color:var(--color-primary-d)}
    .track-timeline{display:flex;justify-content:space-between;margin-top:1rem;position:relative;gap:0.75rem}
    .track-timeline::before{content:'';position:absolute;top:11px;left:10%;right:10%;height:2px;background:var(--color-border)}
    .track-step{text-align:center;position:relative;z-index:1;flex:1}
    .track-step-dot{width:22px;height:22px;border-radius:50%;background:var(--color-border);margin:0 auto 0.4rem;border:3px solid #fff;box-shadow:0 0 0 2px var(--color-border)}
    .track-step.done .track-step-dot{background:var(--color-primary);box-shadow:0 0 0 2px var(--color-primary)}
    .track-step-label{font-size:0.72rem;color:var(--color-body);font-weight:500}
    .timeline-messages{margin-top:1rem;border-top:1px solid rgba(209,209,209,0.5);padding-top:0.75rem}
    .msg{font-size:0.86rem;color:var(--color-body);padding:0.2rem 0}
    .note-row{display:flex;gap:0.6rem;margin-top:1rem}
    .note-row input{flex:1;padding:0.7rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition)}
    .note-row input:focus{border-color:var(--color-primary)}
    .btn-note{background:var(--color-primary);color:#fff;border:none;padding:0.7rem 1rem;border-radius:var(--radius-sm);font-weight:600;transition:var(--transition)}
    .btn-note:hover{background:var(--color-primary-d)}
    .modal-close-btn{position:absolute;top:1.25rem;right:1.25rem;background:var(--color-bg);border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .modal-close-btn:hover{background:var(--color-border)}
    .payment-section{margin:1rem 0;padding:1rem;background:rgba(136,173,53,0.06);border-radius:12px}
    .qr-gallery{display:flex;gap:10px;flex-wrap:wrap}
    .qr-image{width:120px;height:120px;object-fit:contain;border:1px solid var(--color-border);border-radius:8px}
    @media (max-width:600px){.track-card{padding:1.5rem}.track-input-group,.note-row{flex-direction:column}.track-timeline{flex-wrap:wrap}.track-timeline::before{left:12%;right:12%}}
    `
  ]
})
export class TrackOrderModalComponent implements OnInit {
  open = false;
  order = signal<Order | null>(null);
  searchError = signal('');
  paymentQrImages = signal<string[]>([]);

  constructor(private state: AppStateService) {}

  ngOnInit() {
    this.state.trackModal$.subscribe(val => {
      this.open = val.open;
      if (val.open && val.orderNumber) {
        this.fetchOrder(val.orderNumber);
      } else if (!val.open) {
        this.order.set(null);
        this.searchError.set('');
      }
    });

    // Payment QR images from site content (section 'payment-qr')
    this.state.siteContent$.subscribe(items => {
      const urls = items
        .filter(i => i.sectionName === 'payment-qr' && i.kind === 'Image' && i.imageUrl)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(i => resolveSiteImageUrl(i.imageUrl!));
      this.paymentQrImages.set(urls);
    });
  }

  close() {
    this.state.hideTrackModal();
  }

  lookup(id: string, phone: string) {
    this.searchError.set('');
    const trimmedId = id?.trim();
    const trimmedPhone = phone?.trim();

    if (trimmedId) {
      this.fetchOrder(trimmedId);
    } else if (trimmedPhone) {
      this.state.findOrderByPhone(trimmedPhone).subscribe({
        next: orders => {
          if (orders.length > 0) {
            this.order.set(orders[0]);
          } else {
            this.order.set(null);
            this.searchError.set('No orders found for that phone number.');
          }
        },
        error: () => this.searchError.set('Could not search orders.')
      });
    } else {
      this.searchError.set('Enter an Order ID or phone number.');
    }
  }

  fetchOrder(orderNumber: string) {
    this.searchError.set('');
    this.state.getOrderByNumber(orderNumber).subscribe({
      next: order => this.order.set(order),
      error: () => this.searchError.set('Order not found.')
    });
  }

  sendNote(text: string) {
    const ord = this.order();
    if (!ord || !text.trim()) return;
    this.state.addOrderMessageByNumber(ord.publicOrderNumber, text.trim()).subscribe({
      next: (msg) => {
        this.order.update(o => o ? { ...o, messages: [...o.messages, msg] } : o);
      },
      error: () => this.searchError.set('Could not send message.')
    });
  }
}