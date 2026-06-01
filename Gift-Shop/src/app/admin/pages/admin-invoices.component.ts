import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Invoices</h1>
      <p>Invoice management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Invoices" message="Generate, download, and manage PDF invoices with customizable branding." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminInvoicesComponent {
  wipOpen = signal(true);
}
