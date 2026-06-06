import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { AdminApiService, SiteContentSummary } from '../services/admin-api.services';

interface SectionDef {
  key: string;
  label: string;
  sectionName: string;
  hasImages: boolean;
  textFields: { key: string; label: string; placeholder: string; multiline?: boolean }[];
}

const SECTIONS: SectionDef[] = [
  {
    key: 'hero', label: 'Hero Section', sectionName: 'hero', hasImages: true,
    textFields: [
      { key: 'hero.heading', label: 'Heading prefix ("Welcome to")', placeholder: 'Welcome to' },
      { key: 'hero.subheading', label: 'Brand name (italic)', placeholder: 'Kalakaari Gifting' },
      { key: 'hero.copy', label: 'Sub-paragraph', placeholder: 'Discover the Charm...', multiline: true },
    ]
  },
  {
    key: 'manifesto', label: 'Manifesto / Our Story', sectionName: 'manifesto', hasImages: false,
    textFields: [
      { key: 'manifesto.quote', label: 'Blockquote text', placeholder: 'We believe that a gift...', multiline: true },
    ]
  },
  {
    key: 'feature-1', label: 'Feature Block 1 (Crafted by Hands)', sectionName: 'feature-1', hasImages: true,
    textFields: [
      { key: 'feature-1.para1', label: 'Paragraph text', placeholder: 'Unlike mass-produced...', multiline: true },
    ]
  },
  {
    key: 'feature-2', label: 'Feature Block 2 (Unboxing Experience)', sectionName: 'feature-2', hasImages: true,
    textFields: [
      { key: 'feature-2.para1', label: 'Paragraph text', placeholder: 'Presentation is half...', multiline: true },
    ]
  },
];

@Component({
  selector: 'app-admin-homepage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="hp-page">
      <div class="hp-header">
        <div>
          <h1 class="hp-title">Homepage Content</h1>
          <p class="hp-sub">Manage text and images for each storefront section</p>
        </div>
        <button class="btn-secondary" (click)="loadAll()" [disabled]="loading()">
          @if (loading()) { <span class="spinner"></span> } @else { ↻ } Refresh
        </button>
      </div>

      @if (globalError()) {
        <div class="alert alert-error">{{ globalError() }}</div>
      }

      <!-- Section tabs -->
      <div class="section-tabs">
        @for (sec of sections; track sec.key) {
          <button class="tab" [class.active]="activeSection() === sec.key"
            (click)="activeSection.set(sec.key)">
            {{ sec.label }}
          </button>
        }
      </div>

      @for (sec of sections; track sec.key) {
        @if (activeSection() === sec.key) {
          <div class="section-panel">

            <!-- ── Images ── -->
            @if (sec.hasImages) {
              <div class="panel-card">
                <h3 class="panel-title">Section Images <span class="panel-sub">(multiple images auto-slideshow)</span></h3>

                <div class="upload-zone"
                  [class.dragover]="dragSection() === sec.key"
                  (dragover)="$event.preventDefault(); dragSection.set(sec.key)"
                  (dragleave)="dragSection.set('')"
                  (drop)="onDrop($event, sec)"
                  (click)="triggerFileInput(sec.key)">
                  <input [id]="'fi-' + sec.key" type="file" accept="image/jpeg,image/png,image/webp"
                    multiple style="display:none" (change)="onFilesSelected($event, sec)" />
                  <div class="upload-icon">📤</div>
                  <p class="upload-label">Drop images or <strong>click to browse</strong></p>
                  <p class="upload-hint">Max 8MB · JPEG, PNG, WebP · Images slideshow automatically</p>
                </div>

                @if (uploadProgress(sec.key).length > 0) {
                  <div class="progress-list">
                    @for (up of uploadProgress(sec.key); track up.name) {
                      <div class="progress-item" [class.done]="up.done" [class.err]="up.error">
                        <span>{{ up.name }}</span>
                        @if (up.done) { <span class="st-done">✓ Uploaded</span> }
                        @else if (up.error) { <span class="st-err">✗ {{ up.error }}</span> }
                        @else { <span class="spinner-sm"></span> }
                      </div>
                    }
                  </div>
                }

                <!-- Existing images for this section -->
                @if (sectionImages(sec.sectionName).length > 0) {
                  <div class="img-row">
                    @for (img of sectionImages(sec.sectionName); track img.id) {
                      <div class="img-chip" [class.inactive]="!img.isActive">
                        <img [src]="imgPreviewUrl(img)" [alt]="img.altText || sec.label" class="chip-img" />
                        <div class="chip-meta">
                          <span class="chip-key">{{ img.altText || ('Image ' + (img.sortOrder + 1)) }}</span>
                          <span class="chip-order">Sort: {{ img.sortOrder }}</span>
                        </div>
                        <div class="chip-actions">
                          <button class="chip-btn" title="{{ img.isActive ? 'Hide' : 'Show' }}" (click)="toggleItem(img)">
                            {{ img.isActive ? '👁' : '🚫' }}
                          </button>
                          <button class="chip-btn danger" title="Delete" (click)="deleteItem(img)">🗑️</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="no-content">No images uploaded yet for this section.</p>
                }
              </div>
            }

            <!-- ── Text Content ── -->
            <div class="panel-card">
              <h3 class="panel-title">Text Content</h3>

              @for (tf of sec.textFields; track tf.key) {
                <div class="field">
                  <label>{{ tf.label }}</label>

                  @if (tf.multiline) {
                    <textarea class="textarea" rows="4" [placeholder]="tf.placeholder"
                      [(ngModel)]="textValues[tf.key]"></textarea>
                  } @else {
                    <input type="text" class="input" [placeholder]="tf.placeholder"
                      [(ngModel)]="textValues[tf.key]" />
                  }

                  <button class="btn-save-text" (click)="saveText(tf.key, sec.sectionName)"
                    [disabled]="savingText[tf.key]">
                    @if (savingText[tf.key]) { <span class="spinner-sm"></span> Saving… }
                    @else { Save Text }
                  </button>

                  @if (savedText[tf.key]) {
                    <span class="saved-badge">✓ Saved</span>
                  }
                </div>
              }
            </div>

          </div>
        }
      }

    </div>
  `,
  styles: [`
    .hp-page { color: #c0c0c0; font-family: 'Inter', sans-serif; }
    .hp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }
    .hp-title { font-size: 22px; font-weight: 700; color: #f0f0f0; }
    .hp-sub { font-size: 13px; color: #666; margin-top: 3px; }

    .btn-secondary { background: #1c1c20; color: #c0c0c0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }

    /* Section tabs */
    .section-tabs { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
    .tab { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #888; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .tab:hover { color: #f0f0f0; border-color: rgba(255,255,255,0.15); }
    .tab.active { background: rgba(136,173,53,0.12); border-color: rgba(136,173,53,0.3); color: #88ad35; font-weight: 600; }

    /* Panel */
    .section-panel { display: flex; flex-direction: column; gap: 16px; }
    .panel-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; }
    .panel-title { font-size: 14px; font-weight: 700; color: #f0f0f0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .panel-sub { font-size: 11.5px; font-weight: 400; color: #555; }

    /* Upload zone */
    .upload-zone { border: 2px dashed rgba(255,255,255,0.08); border-radius: 10px; padding: 22px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 14px; }
    .upload-zone:hover, .upload-zone.dragover { border-color: #88ad35; background: rgba(136,173,53,0.04); }
    .upload-icon { font-size: 22px; margin-bottom: 6px; }
    .upload-label { font-size: 13px; color: #888; margin-bottom: 3px; }
    .upload-label strong { color: #88ad35; }
    .upload-hint { font-size: 11.5px; color: #555; }

    /* Progress */
    .progress-list { margin-bottom: 12px; display: flex; flex-direction: column; gap: 5px; }
    .progress-item { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 10px; font-size: 12px; }
    .st-done { color: #3dcf8e; font-weight: 600; }
    .st-err { color: #e05454; }

    /* Image chips */
    .img-row { display: flex; flex-direction: column; gap: 8px; }
    .img-chip { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px; }
    .img-chip.inactive { opacity: 0.45; }
    .chip-img { width: 52px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
    .chip-meta { flex: 1; }
    .chip-key { display: block; font-size: 12.5px; color: #c0c0c0; font-weight: 500; }
    .chip-order { font-size: 11px; color: #555; }
    .chip-actions { display: flex; gap: 6px; }
    .chip-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 4px 7px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
    .chip-btn:hover { background: rgba(255,255,255,0.09); }
    .chip-btn.danger:hover { background: rgba(224,84,84,0.15); border-color: rgba(224,84,84,0.2); }
    .no-content { font-size: 13px; color: #555; text-align: center; padding: 12px 0; }

    /* Text fields */
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; position: relative; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .input { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: rgba(136,173,53,0.4); }
    .textarea { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; resize: vertical; }
    .textarea:focus { border-color: rgba(136,173,53,0.4); }
    .btn-save-text { align-self: flex-end; background: rgba(136,173,53,0.1); border: 1px solid rgba(136,173,53,0.25); color: #88ad35; border-radius: 7px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; font-family: inherit; }
    .btn-save-text:hover:not(:disabled) { background: rgba(136,173,53,0.18); }
    .btn-save-text:disabled { opacity: 0.5; cursor: not-allowed; }
    .saved-badge { align-self: flex-end; font-size: 11.5px; color: #3dcf8e; font-weight: 600; }

    .spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    .spinner-sm { width: 11px; height: 11px; border: 1.5px solid rgba(255,255,255,0.2); border-top-color: #88ad35; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminHomepageComponent implements OnInit {
  readonly sections = SECTIONS;
  readonly API_BASE = 'http://localhost:5000';

  activeSection = signal('hero');
  loading = signal(false);
  globalError = signal('');
  dragSection = signal('');

  allContent = signal<SiteContentSummary[]>([]);

  textValues: Record<string, string> = {};
  savingText: Record<string, boolean> = {};
  savedText: Record<string, boolean> = {};

  private progMap: Record<string, { name: string; done: boolean; error?: string }[]> = {};

  constructor(private api: AdminApiService, private appState: AppStateService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.api.getAllContent().subscribe({
      next: items => {
        this.allContent.set(items);
        // Populate text field values from existing DB data
        items.filter(i => i.kind === 'Text').forEach(i => {
          this.textValues[i.contentKey] = i.textValue ?? '';
        });
        this.loading.set(false);
      },
      error: () => {
        this.globalError.set('Could not load content. Is the backend running?');
        this.loading.set(false);
      }
    });
  }

  sectionImages(sectionName: string): SiteContentSummary[] {
    return this.allContent()
      .filter(i => i.sectionName === sectionName && i.kind === 'Image')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  imgPreviewUrl(img: SiteContentSummary): string {
    return `${this.API_BASE}/api/content/${img.id}/image`;
  }

  uploadProgress(sectionKey: string): { name: string; done: boolean; error?: string }[] {
    return this.progMap[sectionKey] ?? [];
  }

  // ── Image uploads ────────────────────────────────────────────────────

  triggerFileInput(sectionKey: string) {
    const el = document.getElementById('fi-' + sectionKey) as HTMLInputElement;
    el?.click();
  }

  onFilesSelected(event: Event, sec: SectionDef) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.doUpload(Array.from(input.files), sec);
    input.value = '';
  }

  onDrop(event: DragEvent, sec: SectionDef) {
    event.preventDefault();
    this.dragSection.set('');
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) this.doUpload(files, sec);
  }

  doUpload(files: File[], sec: SectionDef) {
    const MAX = 8 * 1024 * 1024;
    const valid = files.filter(f => f.size <= MAX);
    if (!valid.length) { this.globalError.set('Files exceed 8MB limit.'); return; }
    this.globalError.set('');

    const progress = valid.map(f => ({ name: f.name, done: false }));
    this.progMap[sec.key] = progress;

    // Calculate next sort order
    const existingMax = this.sectionImages(sec.sectionName).reduce((m, i) => Math.max(m, i.sortOrder), -1);

    valid.forEach((file, idx) => {
      const sortOrder = existingMax + 1 + idx;
      const contentKey = `${sec.sectionName}.image.${sortOrder}`;
      this.api.uploadSectionImage(file, sec.sectionName, contentKey, file.name, sortOrder).subscribe({
        next: (created) => {
          this.progMap[sec.key] = this.progMap[sec.key].map((p, i) => i === idx ? { ...p, done: true } : p);
          // Refresh content list
          this.api.getAllContent().subscribe(items => {
            this.allContent.set(items);
            // Propagate to public storefront
            this.appState.loadSiteContent();
          });
        },
        error: (err) => {
          this.progMap[sec.key] = this.progMap[sec.key].map((p, i) => i === idx ? { ...p, error: err?.error?.error ?? 'Upload failed' } : p);
        }
      });
    });
  }

  deleteItem(img: SiteContentSummary) {
    this.api.deleteContent(img.id).subscribe({
      next: () => {
        this.allContent.update(prev => prev.filter(i => i.id !== img.id));
        this.appState.loadSiteContent();
      },
      error: () => this.globalError.set('Failed to delete item.')
    });
  }

  toggleItem(img: SiteContentSummary) {
    this.api.toggleContent(img.id).subscribe({
      next: (res) => {
        this.allContent.update(prev => prev.map(i => i.id === img.id ? { ...i, isActive: res.isActive } : i));
        this.appState.loadSiteContent();
      }
    });
  }

  saveText(key: string, sectionName: string) {
    this.savingText[key] = true;
    this.savedText[key] = false;
    const val = this.textValues[key] ?? '';
    this.api.upsertTextContent(key, sectionName, val).subscribe({
      next: () => {
        this.savingText[key] = false;
        this.savedText[key] = true;
        setTimeout(() => this.savedText[key] = false, 2500);
        // Propagate to public storefront
        this.appState.loadSiteContent();
      },
      error: () => {
        this.savingText[key] = false;
        this.globalError.set('Failed to save text content.');
      }
    });
  }
}
