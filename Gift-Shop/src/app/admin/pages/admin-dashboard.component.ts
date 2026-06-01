import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Dashboard</h1>
      <p>Overview and analytics coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Dashboard" message="The overview dashboard is being designed. This will show key metrics, recent orders, and system health." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminDashboardComponent {
  wipOpen = signal(true);
}
