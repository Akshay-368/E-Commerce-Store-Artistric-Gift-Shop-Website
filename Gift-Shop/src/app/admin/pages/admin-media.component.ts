import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { AdminWipModalComponent } from '../components/admin-ui.component';

@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [CommonModule, AdminWipModalComponent],
  template: `
    <div>
      <h1>Media Library</h1>
      <p>Media management coming soon...</p>
    </div>
    <adm-wip-modal [open]="wipOpen()" title="Media Library" message="Upload, organize, and manage all product images with Cloudinary integration." (close)="wipOpen.set(false)"></adm-wip-modal>
  `
})
export class AdminMediaComponent {
  wipOpen = signal(true);
}
