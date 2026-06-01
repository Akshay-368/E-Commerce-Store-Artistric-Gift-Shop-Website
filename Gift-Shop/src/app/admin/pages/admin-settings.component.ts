import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Settings</h1>
      <p>System settings coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Settings" message="Configure site-wide settings, colors, typography, UPI details, and business information." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminSettingsComponent {
  wipOpen = signal(true);
}
