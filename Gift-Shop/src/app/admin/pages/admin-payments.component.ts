import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent } from '../components/admin-ui.component';
import { AdminApiService, AdminOrderListItem } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent],
  template: `
    <adm-section title="Payments" sub="Verify UPI payments, mark as failed, review transaction IDs">
      <adm-btn variant="secondary" [disabled]="loading()" (clicked)="loadOrders()">↻ Refresh</adm-btn>
    </adm-section>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    @if (loading()) { <div class="skeleton-table">@for (s of [1,2,3]; track s) {<div class="skeleton-row"></div>}</div> }
    @else if (orders().length === 0) { <div class="empty-state">No orders with pending payment.</div> }
    @else {
      <div class="order-table">
        <div class="table-head">
          <span>Order #</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Payment</span>
          <span>Date</span>
          <span class="center">Actions</span>
        </div>
        @for (o of orders(); track o.id) {
          <div class="table-row">
            <span class="order-number">{{ o.publicOrderNumber }}</span>
            <span>{{ o.customerName }}</span>
            <span>₹{{ o.totalAmount }}</span>
            <span><adm-badge [label]="o.paymentStatus" [color]="o.paymentStatus === 'Verified' ? 'green' : 'yellow'"></adm-badge></span>
            <span>{{ o.createdAt | date:'short' }}</span>
            <span class="center actions">
              <adm-btn variant="primary" (clicked)="verifyPayment(o)">Verify</adm-btn>
              <adm-btn variant="danger" (clicked)="failPayment(o)">Fail</adm-btn>
            </span>
          </div>
        }
      </div>
    }

    <!-- Quick verification modal -->
    @if (selectedOrder(); as order) {
      <div class="modal-backdrop" (click)="selectedOrder.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ action() === 'verify' ? 'Verify Payment' : 'Mark Payment Failed' }}</h3>
          <div class="field">
            <label>Transaction ID (optional)</label>
            <input type="text" [(ngModel)]="txnId" placeholder="Enter UPI reference ID" class="input" />
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="selectedOrder.set(null)">Cancel</button>
            <button class="btn-primary" (click)="confirmAction()">Confirm</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Same base styles as orders component */
    :host { display: block; color: #c0c0c0; }
    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }
    .skeleton-table { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row { height: 40px; border-radius: 6px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .empty-state { text-align: center; padding: 40px; color: #555; }
    .order-table { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row { display: grid; grid-template-columns: 1.2fr 1.5fr 0.8fr 0.8fr 1fr 0.8fr; gap: 8px; padding: 10px 16px; align-items: center; }
    .table-head { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .table-row { border-bottom: 1px solid rgba(255,255,255,0.04); }
    .table-row:hover { background: rgba(255,255,255,0.02); }
    .order-number { font-weight: 600; color: #f0f0f0; font-family: monospace; }
    .center { text-align: center; }
    .actions { display: flex; gap: 6px; justify-content: center; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .modal { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; max-width: 400px; width: 90%; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #f0f0f0; margin-bottom: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .input { background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; width: 100%; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-secondary { background: #1c1c20; color: #c0c0c0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #88ad35; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
  `]
})
export class AdminPaymentsComponent implements OnInit {
  orders = signal<AdminOrderListItem[]>([]);
  loading = signal(false);
  error = signal('');
  selectedOrder = signal<AdminOrderListItem | null>(null);
  action = signal<'verify' | 'fail'>('verify');
  txnId = '';

  constructor(private api: AdminApiService) {}

  ngOnInit() { this.loadOrders(); }

  loadOrders() {
    this.loading.set(true);
    this.error.set('');
    // Filter for orders with Pending payment
    this.api.getOrders(1, 50, 'PendingPayment').subscribe({
      next: (res) => { this.orders.set(res.items); this.loading.set(false); },
      error: () => { this.error.set('Could not load orders.'); this.loading.set(false); }
    });
  }

  verifyPayment(order: AdminOrderListItem) {
    this.selectedOrder.set(order);
    this.action.set('verify');
    this.txnId = '';
  }

  failPayment(order: AdminOrderListItem) {
    this.selectedOrder.set(order);
    this.action.set('fail');
    this.txnId = '';
  }

  confirmAction() {
    const order = this.selectedOrder();
    if (!order) return;
    const status = this.action() === 'verify' ? 'Verified' : 'Failed';
    this.api.updateOrderPayment(order.id, status, this.txnId || undefined).subscribe({
      next: () => {
        this.selectedOrder.set(null);
        this.loadOrders();
      },
      error: () => this.error.set('Action failed.')
    });
  }
}