import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Products</h1>
      <p>Product catalog management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Product Catalog" message="Create, edit, and manage your product inventory with image uploads and pricing controls." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminProductsComponent {
  wipOpen = signal(true);
}
