import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-homepage',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Homepage Content</h1>
      <p>Homepage management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Homepage Content" message="Edit hero section, manifesto, feature blocks, highlights, and all storytelling content." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminHomepageComponent {
  wipOpen = signal(true);
}
