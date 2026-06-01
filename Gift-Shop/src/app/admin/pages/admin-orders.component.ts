import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Orders</h1>
      <p>Order management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Orders" message="View, search, and manage all customer orders with full order details and lifecycle tracking." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminOrdersComponent {
  wipOpen = signal(true);
}
