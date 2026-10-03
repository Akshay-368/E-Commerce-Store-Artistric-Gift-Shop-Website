import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Analytics</h1>
      <p>Detailed analytics and reporting coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Analytics" message="Advanced analytics with charts, trends, and performance metrics." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminAnalyticsComponent {
  wipOpen = signal(true);
}
