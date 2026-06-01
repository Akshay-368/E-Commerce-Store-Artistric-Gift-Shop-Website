import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Categories</h1>
      <p>Category management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Categories" message="Create and manage product categories for better catalog organization." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminCategoriesComponent {
  wipOpen = signal(true);
}
