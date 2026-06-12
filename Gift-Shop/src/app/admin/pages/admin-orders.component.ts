import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent } from '../components/admin-ui.component';
import { AdminApiService, AdminOrderDetail, AdminOrderListItem } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent],
  template: `
    <adm-section title="Orders" sub="Manage customer orders, update status, verify payments">
      <div class="actions-bar">
        <select class="filter-select" [(ngModel)]="filterStatus" (change)="loadOrders()">
          <option value="">All Statuses</option>
          <option value="PendingPayment">Pending Payment</option>
          <option value="PaymentVerified">Payment Verified</option>
          <option value="Packed">Packed</option>
          <option value="Dispatched">Dispatched</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <adm-btn variant="secondary" [disabled]="loading()" (clicked)="loadOrders()">
          ↻ Refresh
        </adm-btn>
      </div>
    </adm-section>

    @if (error()) {
      <div class="alert alert-error">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="skeleton-table">
        @for (s of [1,2,3,4,5]; track s) { <div class="skeleton-row"></div> }
      </div>
    } @else if (orders().length === 0) {
      <div class="empty-state">No orders found.</div>
    } @else {
      <div class="order-table">
        <div class="table-head">
          <span>Order #</span>
          <span>Customer</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Payment</span>
          <span class="right">Total</span>
          <span class="right">Items</span>
          <span class="right">Date</span>
          <span class="center">Actions</span>
        </div>
        @for (o of orders(); track o.id) {
          <div class="table-row" [class.selected]="selectedOrder()?.id === o.id">
            <span class="order-number">{{ o.publicOrderNumber }}</span>
            <span>{{ o.customerName }}</span>
            <span>{{ o.customerPhone }}</span>
            <span><adm-badge [label]="o.status" [color]="statusColor(o.status)"></adm-badge></span>
            <span><adm-badge [label]="o.paymentStatus" [color]="paymentColor(o.paymentStatus)"></adm-badge></span>
            <span class="right">₹{{ o.totalAmount | number }}</span>
            <span class="right">{{ o.itemCount }}</span>
            <span class="right">{{ o.createdAt | date:'short' }}</span>
            <span class="center actions">
              <adm-btn variant="secondary" (clicked)="viewOrder(o.id)">Details</adm-btn>
            </span>
          </div>
        }
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <adm-btn variant="secondary" [disabled]="page() <= 1" (clicked)="changePage(-1)">← Prev</adm-btn>
        <span class="page-info">Page {{ page() }} / {{ totalPages() }}</span>
        <adm-btn variant="secondary" [disabled]="page() >= totalPages()" (clicked)="changePage(1)">Next →</adm-btn>
      </div>
    }

    <!-- Order Detail Modal -->
    @if (selectedOrder(); as order) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Order {{ order.publicOrderNumber }}</h3>
            <button class="close-btn" (click)="closeModal()">✕</button>
          </div>

          <!-- Customer info -->
          <div class="detail-section">
            <h4>Customer</h4>
            <p>{{ order.customerName }} | {{ order.customerPhone }}</p>
            <p>{{ order.customerAddress }}</p>
          </div>

          <!-- Status & Payment -->
          <div class="detail-section">
            <div class="detail-row">
              <span>Status:</span>
              <adm-badge [label]="order.status" [color]="statusColor(order.status)"></adm-badge>
            </div>
            <div class="detail-row">
              <span>Payment:</span>
              <adm-badge [label]="order.paymentStatus" [color]="paymentColor(order.paymentStatus)"></adm-badge>
            </div>
            @if (order.transactionId) {
              <div class="detail-row">
                <span>Transaction ID:</span>
                <span>{{ order.transactionId }}</span>
              </div>
            }
          </div>

          <!-- Items -->
          <div class="detail-section">
            <h4>Items</h4>
            <table class="items-table">
              <thead>
                <tr><th>Product</th><th class="right">Price</th><th class="center">Qty</th><th class="right">Line Total</th></tr>
              </thead>
              <tbody>
                @for (item of order.items; track item.id) {
                  <tr>
                    <td>{{ item.titleSnapshot }}</td>
                    <td class="right">₹{{ item.priceSnapshot }}</td>
                    <td class="center">{{ item.quantity }}</td>
                    <td class="right">₹{{ item.priceSnapshot * item.quantity }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="3" class="right">Subtotal:</td><td class="right">₹{{ order.subtotal }}</td></tr>
                <tr><td colspan="3" class="right">Shipping:</td><td class="right">₹{{ order.shippingFee }}</td></tr>
                <tr class="total-row"><td colspan="3" class="right"><strong>Total:</strong></td><td class="right"><strong>₹{{ order.totalAmount }}</strong></td></tr>
              </tfoot>
            </table>
          </div>

          <!-- Messages -->
          <div class="detail-section">
            <h4>Messages</h4>
            <div class="messages-box">
              @for (msg of order.messages; track msg.id) {
                <div class="msg">
                  <span class="msg-sender">{{ msg.sender }}</span>
                  <span class="msg-text">{{ msg.messageText }}</span>
                  <span class="msg-time">{{ msg.createdAt | date:'short' }}</span>
                </div>
              }
              @if (order.messages.length === 0) {
                <p class="no-msg">No messages yet.</p>
              }
            </div>
            <div class="msg-input-row">
              <input type="text" placeholder="Add admin note..." [(ngModel)]="newMessage" (keydown.enter)="sendMessage()" />
              <adm-btn variant="primary" (clicked)="sendMessage()" [disabled]="!newMessage.trim()">Send</adm-btn>
            </div>
          </div>

          <!-- Actions -->
          <div class="detail-actions">
            <!-- Status update -->
            <div class="action-group">
              <select [(ngModel)]="selectedStatus">
                <option value="">Update Status</option>
                <option value="PaymentVerified">Payment Verified</option>
                <option value="Packed">Packed</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <adm-btn variant="primary" (clicked)="updateStatus()" [disabled]="!selectedStatus">Apply</adm-btn>
            </div>
            <!-- Payment verification -->
            <div class="action-group">
              <input type="text" placeholder="Transaction ID (optional)" [(ngModel)]="transactionIdInput" />
              <adm-btn variant="primary" (clicked)="verifyPayment()">Mark Verified</adm-btn>
              <adm-btn variant="danger" (clicked)="failPayment()">Mark Failed</adm-btn>
            </div>
            <!-- Invoice -->
            <adm-btn variant="secondary" (clicked)="downloadInvoice()">📄 Invoice PDF</adm-btn>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Reuse admin dark theme variables */
    :host { display: block; color: #c0c0c0; }
    .actions-bar { display: flex; gap: 10px; align-items: center; }
    .filter-select { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #f0f0f0; font-family: inherit; font-size: 13px; outline: none; }
    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }
    .skeleton-table { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row { height: 40px; border-radius: 6px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .empty-state { text-align: center; padding: 40px; color: #555; }
    .order-table { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row { display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 0.8fr 0.8fr 0.6fr 0.5fr 0.8fr 0.8fr; gap: 8px; padding: 10px 16px; align-items: center; }
    .table-head { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .table-row { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
    .table-row:hover { background: rgba(255,255,255,0.02); }
    .table-row.selected { background: rgba(136,173,53,0.06); }
    .right { text-align: right; }
    .center { text-align: center; }
    .order-number { font-weight: 600; color: #f0f0f0; font-family: monospace; }
    .actions { display: flex; justify-content: center; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .page-info { font-size: 13px; color: #888; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .modal { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h3 { font-size: 18px; font-weight: 700; color: #f0f0f0; }
    .close-btn { background: none; border: none; color: #888; font-size: 18px; cursor: pointer; }
    .detail-section { margin-bottom: 16px; }
    .detail-section h4 { font-size: 13px; font-weight: 700; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-row { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; font-size: 13px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .items-table th, .items-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left; }
    .items-table tfoot td { padding-top: 8px; }
    .total-row td { font-weight: 700; color: #f0f0f0; }
    .messages-box { max-height: 150px; overflow-y: auto; margin-bottom: 8px; }
    .msg { display: flex; gap: 8px; font-size: 13px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .msg-sender { font-weight: 600; color: #88ad35; min-width: 60px; }
    .msg-text { flex: 1; color: #ccc; }
    .msg-time { font-size: 11px; color: #555; }
    .no-msg { font-size: 13px; color: #555; }
    .msg-input-row { display: flex; gap: 8px; align-items: center; }
    .msg-input-row input { flex: 1; background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; color: #f0f0f0; font-family: inherit; font-size: 13px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
    .action-group { display: flex; gap: 6px; align-items: center; }
    .action-group select, .action-group input { background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px; color: #f0f0f0; font-family: inherit; font-size: 13px; }
    @media (max-width: 768px) {
      .table-head, .table-row { grid-template-columns: 1fr 1fr 1fr 0.6fr 0.6fr 0.5fr; }
      .table-head span:nth-child(7), .table-row span:nth-child(7),
      .table-head span:nth-child(8), .table-row span:nth-child(8) { display: none; }
    }
  `]
})
export class AdminOrdersComponent implements OnInit {
  orders = signal<AdminOrderListItem[]>([]);
  loading = signal(false);
  error = signal('');
  page = signal(1);
  pageSize = 20;
  total = signal(0);
  totalPages = () => Math.ceil(this.total() / this.pageSize) || 1;
  filterStatus = '';

  selectedOrder = signal<AdminOrderDetail | null>(null);
  newMessage = '';
  selectedStatus = '';
  transactionIdInput = '';

  constructor(private api: AdminApiService) {}

  ngOnInit() { this.loadOrders(); }

  loadOrders() {
    this.loading.set(true);
    this.error.set('');
    this.api.getOrders(this.page(), this.pageSize, this.filterStatus || undefined).subscribe({
      next: (res) => {
        this.orders.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Could not load orders.');
        this.loading.set(false);
      }
    });
  }

  changePage(delta: number) {
    this.page.update(p => p + delta);
    this.loadOrders();
  }

  viewOrder(id: string) {
    this.error.set('');
    this.api.getOrder(id).subscribe({
      next: (order) => this.selectedOrder.set(order),
      error: () => this.error.set('Could not load order details.')
    });
  }

  closeModal() {
    this.selectedOrder.set(null);
  }

  updateStatus() {
    const order = this.selectedOrder();
    if (!order || !this.selectedStatus) return;
    this.api.updateOrderStatus(order.id, this.selectedStatus).subscribe({
      next: (res) => {
        this.selectedOrder.set({ ...order, status: res.status, paymentStatus: res.paymentStatus });
        this.loadOrders();
        this.selectedStatus = '';
      },
      error: () => this.error.set('Failed to update status.')
    });
  }

  verifyPayment() {
    const order = this.selectedOrder();
    if (!order) return;
    this.api.updateOrderPayment(order.id, 'Verified', this.transactionIdInput || undefined).subscribe({
      next: (res) => {
        this.selectedOrder.set({ ...order, paymentStatus: 'Verified', status: res.status, transactionId: res.transactionId });
        this.loadOrders();
        this.transactionIdInput = '';
      },
      error: () => this.error.set('Failed to verify payment.')
    });
  }

  failPayment() {
    const order = this.selectedOrder();
    if (!order) return;
    this.api.updateOrderPayment(order.id, 'Failed', this.transactionIdInput || undefined).subscribe({
      next: (res) => {
        this.selectedOrder.set({ ...order, paymentStatus: 'Failed', transactionId: res.transactionId });
        this.loadOrders();
        this.transactionIdInput = '';
      },
      error: () => this.error.set('Failed to update payment.')
    });
  }

  sendMessage() {
    const order = this.selectedOrder();
    const text = this.newMessage.trim();
    if (!order || !text) return;
    this.api.addOrderMessage(order.id, text).subscribe({
      next: (msg) => {
        this.selectedOrder.set({ ...order, messages: [...order.messages, msg] });
        this.newMessage = '';
      },
      error: () => this.error.set('Failed to send message.')
    });
  }

  downloadInvoice() {
    const order = this.selectedOrder();
    if (!order) return;
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

  statusColor(s: string): any {
    const map: Record<string, string> = {
      PendingPayment: 'yellow',
      PaymentVerified: 'blue',
      Packed: 'accent',
      Dispatched: 'blue',
      Delivered: 'green',
      Cancelled: 'red'
    };
    return map[s] || 'gray';
  }

  paymentColor(s: string): any {
    const map: Record<string, string> = {
      Pending: 'yellow',
      Verified: 'green',
      Failed: 'red',
      Refunded: 'gray'
    };
    return map[s] || 'gray';
  }
}