import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Security</h1>
      <p>Security settings coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Security" message="Manage admin users, permissions, password resets, audit logs, and access control." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminSecurityComponent {
  wipOpen = signal(true);
}
