import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-tracking',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Tracking</h1>
      <p>Tracking management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Tracking Settings" message="Configure order tracking statuses, labels, and public timeline visibility." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminTrackingComponent {
  wipOpen = signal(true);
}
