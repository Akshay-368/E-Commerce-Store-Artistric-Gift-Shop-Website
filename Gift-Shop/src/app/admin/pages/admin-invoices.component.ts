import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent } from '../components/admin-ui.component';
import { AdminApiService, AdminOrderListItem } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent],
  template: `
    <adm-section title="Invoices" sub="Download PDF invoices for completed orders">
      <adm-btn variant="secondary" [disabled]="loading()" (clicked)="loadOrders()">↻ Refresh</adm-btn>
    </adm-section>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (loading()) { <div class="skeleton-table">@for (s of [1,2,3]; track s) {<div class="skeleton-row"></div>}</div> }
    @else if (orders().length === 0) { <div class="empty-state">No orders available for invoice.</div> }
    @else {
      <div class="order-table">
        <div class="table-head">
          <span>Order #</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
          <span class="center">Invoice</span>
        </div>
        @for (o of orders(); track o.id) {
          <div class="table-row">
            <span class="order-number">{{ o.publicOrderNumber }}</span>
            <span>{{ o.customerName }}</span>
            <span>₹{{ o.totalAmount }}</span>
            <span><adm-badge [label]="o.status" [color]="o.status === 'Delivered' ? 'green' : 'gray'"></adm-badge></span>
            <span>{{ o.createdAt | date:'short' }}</span>
            <span class="center"><adm-btn variant="secondary" (clicked)="downloadInvoice(o)">📄 PDF</adm-btn></span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
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
  `]
})
export class AdminInvoicesComponent implements OnInit {
  orders = signal<AdminOrderListItem[]>([]);
  loading = signal(false);
  error = signal('');

  constructor(private api: AdminApiService) {}

  ngOnInit() { this.loadOrders(); }

  loadOrders() {
    this.loading.set(true);
    this.error.set('');
    // Show all orders that are at least payment verified (have invoices)
    this.api.getOrders(1, 50, 'PaymentVerified').subscribe({
      next: (res) => { this.orders.set(res.items); this.loading.set(false); },
      error: () => { this.error.set('Could not load orders.'); this.loading.set(false); }
    });
  }

  downloadInvoice(order: AdminOrderListItem) {
    this.api.downloadInvoice(order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${order.publicOrderNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Could not generate invoice.')
    });
  }
}