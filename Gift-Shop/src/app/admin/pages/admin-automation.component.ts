import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-automation',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Automation</h1>
      <p>Automation rules coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Automation" message="Configure automated status changes, delivery triggers, and scheduled cleanup jobs." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminAutomationComponent {
  wipOpen = signal(true);
}
