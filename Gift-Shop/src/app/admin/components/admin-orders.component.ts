import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBadgeComponent, AdminButtonComponent, AdminSectionComponent } from '../components/admin-ui.component';
import { AdminApiService, AdminOrderDetail, AdminOrderListItem } from '../services/admin-api.services';

// ── Seen orders (localStorage) ──────────────────────────────────────
export const SEEN_ORDERS_KEY = 'adm_seen_order_ids';

export function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ORDERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function saveSeenIds(ids: Set<string>) {
  try { localStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify([...ids])); } catch {}
}

// ── Deletion eligibility rules (must match backend) ──────────────────
// Backend allows deletion ONLY for:  status = Delivered  ot cancelled OR  paymentStatus = Failed
const DELETABLE_STATUSES = new Set(['Delivered', 'Cancelled']);
const DELETABLE_PAYMENT  = new Set(['Failed']);


function isDeletable(o: AdminOrderListItem): boolean {
  return DELETABLE_STATUSES.has(o.status) || DELETABLE_PAYMENT.has(o.paymentStatus);
}

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
        <adm-btn variant="secondary" [disabled]="loading()" (clicked)="loadOrders()">↻ Refresh</adm-btn>
        @if (unseenCount() > 0) {
          <button class="btn-mark-all-seen" (click)="markAllSeen()">
            ✓ Mark all {{ unseenCount() }} new as seen
          </button>
        }

        <!-- Delete selection controls -->
        @if (hasDeletableOrders()) {
          @if (selectedForDelete().size === 0) {
            <button class="btn-select-mode" (click)="enterSelectMode()">🗑 Select to Delete</button>
          } @else {
            <button class="btn-delete-selected"
              (click)="openDeleteConfirm()"
              [disabled]="selectedForDelete().size === 0">
              🗑 Delete Selected ({{ selectedForDelete().size }})
            </button>
            <button class="btn-select-all" (click)="toggleSelectAll()">
              {{ allDeletableSelected() ? 'Deselect All' : 'Select All Eligible' }}
            </button>
            <button class="btn-cancel-select" (click)="exitSelectMode()">✕ Cancel</button>
          }
        }
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
      <div class="order-table" [class.select-mode]="selectModeActive()">
        <!-- Table header -->
        <div class="table-head"
             [class.with-check]="selectModeActive()">
          @if (selectModeActive()) { <span class="col-check"></span> }
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

        <!-- Table rows -->
        @for (o of orders(); track o.id) {
          <div class="table-row"
               [class.with-check]="selectModeActive()"
               [class.selected]="selectedOrder()?.id === o.id"
               [class.row-new]="isUnseen(o.id)"
               [class.row-deletable]="selectModeActive() && isDeletable(o)"
               [class.row-checked]="isChecked(o.id)">
            @if (selectModeActive()) {
              <span class="col-check">
                @if (isDeletable(o)) {
                  <input type="checkbox" class="del-checkbox"
                    [checked]="isChecked(o.id)"
                    (change)="toggleCheck(o.id)" />
                } @else {
                  <span class="del-ineligible"
                    title="Only Delivered or Failed‑payment orders can be deleted">—</span>
                }
              </span>
            }
            <span class="order-number">
              {{ o.publicOrderNumber }}
              @if (isUnseen(o.id)) { <span class="new-dot" title="New order">●</span> }
            </span>
            <span>{{ o.customerName }}</span>
            <span>{{ o.customerPhone }}</span>
            <span><adm-badge [label]="o.status" [color]="statusColor(o.status)"></adm-badge></span>
            <span><adm-badge [label]="o.paymentStatus" [color]="paymentColor(o.paymentStatus)"></adm-badge></span>
            <span class="right">₹{{ o.totalAmount | number }}</span>
            <span class="right">{{ o.itemCount }}</span>
            <span class="right">{{ o.createdAt | date:'short' }}</span>
            <span class="center actions">
              <adm-btn variant="secondary" (clicked)="viewOrder(o.id)">Details</adm-btn>
              @if (isUnseen(o.id)) {
                <button class="btn-seen" (click)="markSeen(o.id)" title="Mark as seen">✓</button>
              }
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

    <!-- ═══ Delete Confirmation Modal ═══ -->
    @if (showDeleteConfirm()) {
      <div class="modal-backdrop" (click)="closeDeleteConfirm()">
        <div class="modal modal-delete" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>⚠️ Confirm Deletion</h3>
            <button class="close-btn" (click)="closeDeleteConfirm()">✕</button>
          </div>

          <div class="delete-summary">
            <p class="delete-count">
              You are about to permanently delete
              <strong>{{ selectedForDelete().size }} order(s)</strong>.
              This cannot be undone.
            </p>
            <p class="delete-note">
              Deleting these orders will also free up their associated products
              from the "ever ordered" restriction — allowing you to delete or
              modify those products and categories afterwards.
            </p>

            <div class="delete-order-list">
              @for (o of ordersToDelete(); track o.id) {
                <div class="delete-order-row">
                  <span class="del-order-num">{{ o.publicOrderNumber }}</span>
                  <span class="del-customer">{{ o.customerName }}</span>
                  <adm-badge [label]="o.status" [color]="statusColor(o.status)"></adm-badge>
                  <span class="del-amount">₹{{ o.totalAmount | number }}</span>
                </div>
              }
            </div>
          </div>

          <div class="invoice-option">
            <label class="invoice-label">
              <input type="checkbox" [(ngModel)]="downloadInvoicesBeforeDelete" />
              <span>Download invoices before deleting</span>
            </label>
            <span class="info-icon" (mouseenter)="showInvoiceTip.set(true)"
              (mouseleave)="showInvoiceTip.set(false)"
              (click)="showInvoiceTip.update(v => !v)">ℹ</span>
            @if (showInvoiceTip()) {
              <div class="invoice-tip">
                Checking this will download the PDF invoice for every selected order
                to your browser before deletion. This is your last resort to keep a
                record of completed orders — once deleted, their data is gone from
                the database permanently.
              </div>
            }
          </div>

          @if (deleteError()) {
            <div class="alert alert-error" style="margin-top:12px">{{ deleteError() }}</div>
          }

          <div class="modal-footer">
            <button class="btn-cancel-delete" (click)="closeDeleteConfirm()" [disabled]="deleting()">
              ✕ Cancel — Keep Orders
            </button>
            <button class="btn-confirm-delete" (click)="confirmDelete()" [disabled]="deleting()">
              @if (deleting()) { <span class="spinner-sm"></span> Deleting… }
              @else { 🗑 Yes, Delete {{ selectedForDelete().size }} Order(s) }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ═══ Order Detail Modal (unchanged) ═══ -->
    @if (selectedOrder(); as order) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Order {{ order.publicOrderNumber }}</h3>
            <button class="close-btn" (click)="closeModal()">✕</button>
          </div>

          <div class="detail-section">
            <h4>Customer</h4>
            <p>{{ order.customerName }} | {{ order.customerPhone }}</p>
            <p>{{ order.customerAddress }}</p>
          </div>

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
              <div class="detail-row"><span>Transaction ID:</span><span>{{ order.transactionId }}</span></div>
            }
          </div>

          <div class="detail-section">
            <h4>Items</h4>
            <table class="items-table">
              <thead><tr><th>Product</th><th class="right">Price</th><th class="center">Qty</th><th class="right">Line Total</th></tr></thead>
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
              @if (order.messages.length === 0) { <p class="no-msg">No messages yet.</p> }
            </div>
            <div class="msg-input-row">
              <input type="text" placeholder="Add admin note..." [(ngModel)]="newMessage" (keydown.enter)="sendMessage()" />
              <adm-btn variant="primary" (clicked)="sendMessage()" [disabled]="!newMessage.trim()">Send</adm-btn>
            </div>
          </div>

          <div class="detail-actions">
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
            <div class="action-group">
              <input type="text" placeholder="Transaction ID (optional)" [(ngModel)]="transactionIdInput" />
              <adm-btn variant="primary" (clicked)="verifyPayment()">Mark Verified</adm-btn>
              <adm-btn variant="danger" (clicked)="failPayment()">Mark Failed</adm-btn>
            </div>
            <adm-btn variant="secondary" (clicked)="downloadInvoice()">📄 Invoice PDF</adm-btn>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; color: #c0c0c0; }

    .actions-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .filter-select { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #f0f0f0; font-family: inherit; font-size: 13px; outline: none; }
    .btn-mark-all-seen { background: rgba(136,173,53,0.12); border: 1px solid rgba(136,173,53,0.35); color: #88ad35; border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn-mark-all-seen:hover { background: rgba(136,173,53,0.22); }

    /* ── Delete mode buttons ── */
    .btn-select-mode { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.25); color: #e05454; border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn-select-mode:hover { background: rgba(224,84,84,0.15); }
    .btn-delete-selected { background: #e05454; border: none; color: #fff; border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn-delete-selected:hover:not(:disabled) { background: #c0392b; }
    .btn-delete-selected:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-select-all { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #c0c0c0; border-radius: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-select-all:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
    .btn-cancel-select { background: none; border: 1px solid rgba(255,255,255,0.1); color: #888; border-radius: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }

    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }

    .skeleton-table { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row { height: 40px; border-radius: 6px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .empty-state { text-align: center; padding: 40px; color: #555; }

    /* ── Order table (default grid WITHOUT checkbox) ── */
    .order-table { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row {
      display: grid;
      grid-template-columns: 1.4fr 1.2fr 1fr 0.8fr 0.8fr 0.6fr 0.5fr 0.8fr 0.9fr;
      gap: 8px; padding: 10px 16px; align-items: center;
    }
    .table-head { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }

    /* ── When select mode is active, add a checkbox column (narrow) ── */
    .order-table.select-mode .table-head.with-check,
    .order-table.select-mode .table-row.with-check {
      grid-template-columns: 0.4fr 1.1fr 1.0fr 0.8fr 0.8fr 0.6fr 0.5fr 0.6fr 0.9fr;
    }

    .table-row { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
    .table-row:hover { background: rgba(255,255,255,0.02); }
    .table-row.selected { background: rgba(136,173,53,0.06); }
    .table-row.row-new { background: rgba(136,173,53,0.05); border-left: 3px solid #88ad35; }
    .table-row.row-checked { background: rgba(224,84,84,0.07); border-left: 3px solid rgba(224,84,84,0.5); }
    .table-row.row-deletable:not(.row-checked):hover { background: rgba(224,84,84,0.04); }

    .col-check { display: flex; align-items: center; justify-content: center; }
    .del-checkbox { width: 15px; height: 15px; accent-color: #e05454; cursor: pointer; }
    .del-ineligible { font-size: 11px; color: #444; }

    .right { text-align: right; }
    .center { text-align: center; }
    .order-number { font-weight: 600; color: #f0f0f0; font-family: monospace; display: flex; align-items: center; gap: 5px; }
    .new-dot { color: #88ad35; font-size: 10px; }
    .actions { display: flex; justify-content: center; gap: 6px; align-items: center; }
    .btn-seen { background: rgba(136,173,53,0.12); border: 1px solid rgba(136,173,53,0.3); color: #88ad35; border-radius: 6px; width: 26px; height: 26px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-seen:hover { background: rgba(136,173,53,0.25); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .page-info { font-size: 13px; color: #888; }

    /* ── Delete confirmation modal ── */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .modal { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-delete { border-color: rgba(224,84,84,0.2); max-width: 560px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h3 { font-size: 18px; font-weight: 700; color: #f0f0f0; }
    .close-btn { background: none; border: none; color: #888; font-size: 18px; cursor: pointer; }

    .delete-summary { margin-bottom: 18px; }
    .delete-count { font-size: 14px; color: #f0f0f0; margin-bottom: 8px; }
    .delete-count strong { color: #e05454; }
    .delete-note { font-size: 12.5px; color: #666; line-height: 1.55; margin-bottom: 14px; }
    .delete-order-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px; }
    .delete-order-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .del-order-num { font-family: monospace; font-size: 12px; color: #88ad35; min-width: 130px; }
    .del-customer { flex: 1; color: #c0c0c0; }
    .del-amount { font-size: 12px; color: #888; }

    /* Invoice option */
    .invoice-option { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; margin-top: 14px; position: relative; }
    .invoice-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13.5px; color: #c0c0c0; }
    .invoice-label input[type=checkbox] { width: 16px; height: 16px; accent-color: #88ad35; cursor: pointer; flex-shrink: 0; }
    .info-icon { width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #888; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-style: italic; font-family: serif; }
    .info-icon:hover { background: rgba(255,255,255,0.14); color: #f0f0f0; }
    .invoice-tip { position: absolute; left: 0; bottom: calc(100% + 8px); background: #2a2a30; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: #aaa; line-height: 1.55; width: 100%; z-index: 10; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

    .modal-footer { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
    .btn-cancel-delete { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #c0c0c0; border-radius: 10px; padding: 10px 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn-cancel-delete:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
    .btn-cancel-delete:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-confirm-delete { background: #e05454; border: none; color: #fff; border-radius: 10px; padding: 10px 20px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 8px; }
    .btn-confirm-delete:hover:not(:disabled) { background: #c0392b; }
    .btn-confirm-delete:disabled { opacity: 0.4; cursor: not-allowed; }
    .spinner-sm { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Detail modal styles */
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
      .table-head, .table-row {
        grid-template-columns: 1fr 1fr 1fr 0.6fr 0.6fr 0.5fr;
      }
      .table-head span:nth-child(7), .table-row span:nth-child(7),
      .table-head span:nth-child(8), .table-row span:nth-child(8) { display: none; }
    }
  `]
})
export class AdminOrdersComponent implements OnInit {
  orders      = signal<AdminOrderListItem[]>([]);
  loading     = signal(false);
  error       = signal('');
  page        = signal(1);
  pageSize    = 20;
  total       = signal(0);
  totalPages  = () => Math.ceil(this.total() / this.pageSize) || 1;
  filterStatus = '';

  selectedOrder       = signal<AdminOrderDetail | null>(null);
  newMessage          = '';
  selectedStatus      = '';
  transactionIdInput  = '';

  // Seen/unseen tracking
  private seenIds = signal<Set<string>>(getSeenIds());
  unseenCount = computed(() => {
    const seen = this.seenIds();
    return this.orders().filter(o => !seen.has(o.id)).length;
  });

  // ── Delete selection state ──
  selectModeActive    = signal(false);
  selectedForDelete   = signal<Set<string>>(new Set());
  showDeleteConfirm   = signal(false);
  deleting            = signal(false);
  deleteError         = signal('');
  downloadInvoicesBeforeDelete = false;
  showInvoiceTip      = signal(false);

  ordersToDelete = computed(() => {
    const ids = this.selectedForDelete();
    return this.orders().filter(o => ids.has(o.id));
  });

  hasDeletableOrders = computed(() =>
    this.orders().some(o => isDeletable(o))
  );

  allDeletableSelected = computed(() => {
    const deletable = this.orders().filter(isDeletable);
    if (deletable.length === 0) return false;
    const ids = this.selectedForDelete();
    return deletable.every(o => ids.has(o.id));
  });

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
        this.seenIds.set(getSeenIds());
        // Remove selections that are no longer on the page
        const currentIds = new Set(res.items.map(o => o.id));
        this.selectedForDelete.update(sel => new Set([...sel].filter(id => currentIds.has(id))));
      },
      error: () => { this.error.set('Could not load orders.'); this.loading.set(false); }
    });
  }

  // ── Seen / unseen helpers ──
  isUnseen(id: string) { return !this.seenIds().has(id); }

  markSeen(id: string) {
    const updated = new Set(this.seenIds());
    updated.add(id);
    saveSeenIds(updated);
    this.seenIds.set(updated);
  }

  markAllSeen() {
    const updated = new Set(this.seenIds());
    this.orders().forEach(o => updated.add(o.id));
    saveSeenIds(updated);
    this.seenIds.set(updated);
  }

  changePage(delta: number) {
    this.page.update(p => p + delta);
    this.loadOrders();
  }

  // ── Delete selection ──
  isDeletable(o: AdminOrderListItem): boolean { return isDeletable(o); }

  enterSelectMode() {
    this.selectModeActive.set(true);
    this.selectedForDelete.set(new Set());
  }

  exitSelectMode() {
    this.selectModeActive.set(false);
    this.selectedForDelete.set(new Set());
  }

  isChecked(id: string): boolean { return this.selectedForDelete().has(id); }

  toggleCheck(id: string) {
    const updated = new Set(this.selectedForDelete());
    if (updated.has(id)) updated.delete(id); else updated.add(id);
    this.selectedForDelete.set(updated);
  }

  toggleSelectAll() {
    if (this.allDeletableSelected()) {
      this.selectedForDelete.set(new Set());
    } else {
      const ids = new Set(this.orders().filter(isDeletable).map(o => o.id));
      this.selectedForDelete.set(ids);
    }
  }

  openDeleteConfirm() {
    if (this.selectedForDelete().size === 0) return;
    this.deleteError.set('');
    this.downloadInvoicesBeforeDelete = false;
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm() {
    if (this.deleting()) return;
    this.showDeleteConfirm.set(false);
    this.deleteError.set('');
  }

  async confirmDelete() {
    const ids = [...this.selectedForDelete()];
    if (ids.length === 0) return;

    this.deleting.set(true);
    this.deleteError.set('');

    // Step 1: optionally download invoices
    if (this.downloadInvoicesBeforeDelete) {
      for (const id of ids) {
        await this.downloadInvoiceById(id);
      }
    }

    // Step 2: delete orders
    this.api.deleteOrders(ids).subscribe({
      next: (res) => {
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
        this.exitSelectMode();
        if (res.skipped?.length > 0) {
          this.error.set(`${res.message} — ${res.skipped.join(', ')} could not be deleted.`);
        }
        this.loadOrders();
      },
      error: (err) => {
        this.deleting.set(false);
        this.deleteError.set(err?.error?.error ?? 'Failed to delete orders. Please try again.');
      }
    });
  }

  private downloadInvoiceById(id: string): Promise<void> {
    return new Promise(resolve => {
      this.api.downloadInvoice(id).subscribe({
        next: (blob) => {
          const order = this.orders().find(o => o.id === id);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-${order?.publicOrderNumber ?? id}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          resolve();
        },
        error: () => resolve() // don't block deletion if one invoice fails
      });
    });
  }

  // ── Order detail modal ──
  viewOrder(id: string) {
    this.error.set('');
    this.markSeen(id);
    this.api.getOrder(id).subscribe({
      next: (order) => this.selectedOrder.set(order),
      error: () => this.error.set('Could not load order details.')
    });
  }

  closeModal() { this.selectedOrder.set(null); }

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
    const map: Record<string,string> = { PendingPayment:'yellow', PaymentVerified:'blue', Packed:'accent', Dispatched:'blue', Delivered:'green', Cancelled:'red' };
    return map[s] || 'gray';
  }

  paymentColor(s: string): any {
    const map: Record<string,string> = { Pending:'yellow', Verified:'green', Failed:'red', Refunded:'gray' };
    return map[s] || 'gray';
  }
}