import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Reviews</h1>
      <p>Review management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Review Management" message="Moderate, approve, and feature customer reviews with verified-purchase enforcement." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminReviewsComponent {
  wipOpen = signal(true);
}
