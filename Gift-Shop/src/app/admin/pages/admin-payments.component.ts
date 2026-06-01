import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Payments</h1>
      <p>Payment management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Payments" message="Verify UPI payments, record transaction IDs, and manage payment statuses." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminPaymentsComponent {
  wipOpen = signal(true);
}
