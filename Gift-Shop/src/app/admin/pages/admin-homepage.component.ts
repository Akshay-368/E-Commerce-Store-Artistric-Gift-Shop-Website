import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HighlightCard } from '../../components/home.component';
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
    key: 'hero', label: '🏠 Hero Section', sectionName: 'hero', hasImages: true,
    textFields: [
      { key: 'hero.badge',      label: 'Badge pill text (top of hero)',           placeholder: '✨ New arrivals every week' },
      { key: 'hero.heading',    label: 'Heading prefix (before brand name)',       placeholder: 'Welcome to' },
      { key: 'hero.subheading', label: 'Brand name (shown in italic)',             placeholder: 'Kalakaari Gifting' },
      { key: 'hero.copy',       label: 'Sub-paragraph text',                       placeholder: 'Discover the Charm...', multiline: true },
    ]
  },
  {
    key: 'manifesto', label: '📖 Our Story', sectionName: 'manifesto', hasImages: false,
    textFields: [
      { key: 'manifesto.quote', label: 'Blockquote / story text', placeholder: 'We believe that a gift...', multiline: true },
    ]
  },
  {
    key: 'feature-1', label: '🎨 Feature 1 (Crafted by Hands)', sectionName: 'feature-1', hasImages: true,
    textFields: [
      { key: 'feature-1.para1', label: 'Paragraph text', placeholder: 'Unlike mass-produced...', multiline: true },
    ]
  },
  {
    key: 'feature-2', label: '🎀 Feature 2 (Unboxing Experience)', sectionName: 'feature-2', hasImages: true,
    textFields: [
      { key: 'feature-2.para1', label: 'Paragraph text', placeholder: 'Presentation is half...', multiline: true },
    ]
  },
  {
    key: 'highlights', label: '✅ Why Choose Us', sectionName: 'highlights', hasImages: false,
    textFields: [
      { key: 'highlights.eyebrow', label: 'Eyebrow label above title', placeholder: 'Why Choose Us' },
      { key: 'highlights.title',   label: 'Section heading',           placeholder: 'A Gift Boutique Like No Other' },
    ]
  },
  {
    key: 'payment-qr', label: '💳 Payment QR', sectionName: 'payment-qr', hasImages: true,
    textFields: []  // only images
  },
  {
    key: 'navbar', label: '🔗 Navbar', sectionName: 'navbar', hasImages: true,  // Now supports logo upload
    textFields: [
      { key: 'navbar.brandName',     label: 'Brand name',                       placeholder: 'Kalakaari Gifting' },
      { key: 'navbar.brandTagline',  label: 'Brand tagline (below brand name)', placeholder: 'Handmade with Love' },
      { key: 'navbar.trackOrder',    label: 'Track Order button label',         placeholder: '📦 Track Order' },
      { key: 'navbar.browseCatalog', label: 'Browse Catalog button label',      placeholder: 'Browse Catalog' },
      { key: 'navbar.orderBag',      label: 'Order Bag button label',           placeholder: '🛍️ Order Bag' },
    ]
  },
  {
    key: 'footer', label: '🦶 Footer', sectionName: 'footer', hasImages: true,
    textFields: [
      { key: 'footer.brandName',        label: 'Footer brand name',                               placeholder: 'Kalakaari Gifting' },
      { key: 'footer.brandTagline',     label: 'Footer brand tagline',                            placeholder: 'Where Creativity Becomes a Gift' },
      { key: 'footer.copy',             label: 'Footer paragraph / description',                  placeholder: 'Curating smiles since 2024...', multiline: true },
      { key: 'footer.linkCatalog',      label: '"Browse Catalog" link label',                     placeholder: 'Browse Catalog' },
      { key: 'footer.linkStory',        label: '"Our Story" link label',                          placeholder: 'Our Story' },
      { key: 'footer.terms',            label: 'Terms & Policies content',                        placeholder: 'Return policy: ...\nPrivacy: ...', multiline: true },
      { key: 'footer.contact.info',     label: 'Contact info (phone, email, hours)',              placeholder: '📞 +91 98765 43210\n📧 hello@kalakaari.in\n⏰ Mon-Sat 10am-6pm', multiline: true },
    ]
  },
  {
    key: 'social-links', label: '🌐 Social Links', sectionName: 'social-links', hasImages: false,
    textFields: []   // custom UI for managing social links
  },
  {
    key: 'payment-details', label: '💳 Payment Details', sectionName: 'payment-details', hasImages: false,
    textFields: []   // custom UI for managing payment info
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
          <p class="hp-sub">Manage every section of your storefront — text, images, and feature cards</p>
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

            <!-- ── Images (for sections that have them) ── -->
            @if (sec.hasImages) {
              <div class="panel-card">
                <h3 class="panel-title">
                  Section Images
                  <span class="panel-sub">(multiple images → auto-slideshow on the storefront)</span>
                </h3>

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
                  <p class="upload-hint">Max 8MB · JPEG, PNG, WebP · Images cycle as a slideshow</p>
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

                @if (sectionImages(sec.sectionName).length > 0) {
                  <div class="img-row">
                    @for (img of sectionImages(sec.sectionName); track img.id) {
                      <div class="img-chip" [class.inactive]="!img.isActive">
                        <img [src]="imgPreviewUrl(img)" [alt]="img.altText || sec.label" class="chip-img" />
                        <div class="chip-meta">
                          <span class="chip-key">{{ img.altText || ('Image ' + (img.sortOrder + 1)) }}</span>
                          <span class="chip-order">Sort order: {{ img.sortOrder }}</span>
                        </div>
                        <div class="chip-actions">
                          <button class="chip-btn" [title]="img.isActive ? 'Hide from storefront' : 'Show on storefront'"
                            (click)="toggleItem(img)">
                            {{ img.isActive ? '👁' : '🚫' }}
                          </button>
                          <button class="chip-btn danger" title="Delete permanently" (click)="deleteItem(img)">🗑️</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="no-content">No images for this section yet. Upload one above.</p>
                }
              </div>
            }

            <!-- ── Text content fields ── -->
            @if (sec.textFields.length > 0) {
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
                    <div class="field-footer">
                      <button class="btn-save-text" (click)="saveText(tf.key, sec.sectionName)"
                        [disabled]="savingText()[tf.key]">
                        @if (savingText()[tf.key]) { <span class="spinner-sm"></span> Saving… }
                        @else { Save }
                      </button>
                      @if (savedText()[tf.key]) { <span class="saved-badge">✓ Saved</span> }
                    </div>
                    @if (tf.key === 'footer.contact.socials') {
                      <!-- This field has been removed, no longer shown -->
                    }
                  </div>
                }
              </div>
            }

            <!-- ── Highlights card editor (only for highlights tab) ── -->
            @if (sec.key === 'highlights') {
              <div class="panel-card">
                <h3 class="panel-title">
                  Feature Cards
                  <span class="panel-sub">(each card = icon emoji + title + description)</span>
                </h3>
                <p class="panel-desc">
                  These cards appear in the "Why Choose Us" grid on the storefront.
                  You can add, edit, reorder, or delete them. Changes are saved individually per card.
                </p>

                <div class="cards-list">
                  @for (card of highlightDrafts; track $index; let i = $index) {
                    <div class="card-editor">
                      <div class="card-editor-header">
                        <span class="card-num">Card {{ i + 1 }}</span>
                        <div class="card-editor-actions">
                          <button class="chip-btn" title="Move up" (click)="moveCard(i, -1)" [disabled]="i === 0">↑</button>
                          <button class="chip-btn" title="Move down" (click)="moveCard(i, 1)" [disabled]="i === highlightDrafts.length - 1">↓</button>
                          <button class="chip-btn danger" title="Remove card" (click)="removeCard(i)">🗑️</button>
                        </div>
                      </div>
                      <div class="card-fields">
                        <div class="field-inline">
                          <label>Icon emoji</label>
                          <input type="text" class="input input-sm" placeholder="🎁" [(ngModel)]="card.icon" maxlength="4" />
                        </div>
                        <div class="field-inline flex-grow">
                          <label>Title</label>
                          <input type="text" class="input" placeholder="Complimentary Gift Wrapping" [(ngModel)]="card.title" />
                        </div>
                      </div>
                      <div class="field">
                        <label>Description</label>
                        <textarea class="textarea" rows="2" placeholder="Every order arrives beautifully wrapped..."
                          [(ngModel)]="card.body"></textarea>
                      </div>
                    </div>
                  }
                </div>

                <div class="cards-footer">
                  <button class="btn-add-card" (click)="addCard()">+ Add Card</button>
                  <button class="btn-primary" (click)="saveHighlights()" [disabled]="savingHighlights()">
                    @if (savingHighlights()) { <span class="spinner-sm"></span> Saving… }
                    @else { Save All Cards }
                  </button>
                  @if (savedHighlights()) { <span class="saved-badge">✓ All cards saved</span> }
                </div>
              </div>
            }

            <!-- ── Social Links custom UI ── -->
            @if (sec.key === 'social-links') {
              <div class="panel-card">
                <h3 class="panel-title">Social Links</h3>
                <div class="field">
                  <label>{{ editingSocialId ? 'Edit Link' : 'New Link' }}</label>
                  <div class="card-fields">
                    <div class="field-inline" style="width:70px">
                      <label>Icon</label>
                      <input type="text" class="input input-sm" [(ngModel)]="newSocial.icon" maxlength="4" />
                    </div>
                    <div class="field-inline flex-grow">
                      <label>Name</label>
                      <input type="text" class="input" [(ngModel)]="newSocial.name" placeholder="Instagram" />
                    </div>
                    <div class="field-inline flex-grow">
                      <label>URL</label>
                      <input type="text" class="input" [(ngModel)]="newSocial.url" placeholder="https://..." />
                    </div>
                    <button class="btn-save-text" (click)="editingSocialId ? updateSocialLink() : addSocialLink()"
                      [disabled]="savingSocial()">
                      {{ editingSocialId ? 'Update' : 'Add' }}
                    </button>
                    @if (editingSocialId) {
                      <button class="btn-save-text" style="background: transparent; border: 1px solid #444; color: #888;"
                        (click)="cancelEditSocial()">Cancel</button>
                    }
                  </div>
                </div>
                @if (socialLinks.length) {
                  <div class="img-row">
                    @for (link of socialLinks; track link.id) {
                      <div class="img-chip" [class.inactive]="!link.isActive">
                        <div class="chip-meta">
                          <span class="chip-key">{{ link.icon }} {{ link.name }}</span>
                          <span class="chip-order">{{ link.url }}</span>
                        </div>
                        <div class="chip-actions">
                          <button class="chip-btn" [title]="link.isActive ? 'Hide' : 'Show'" (click)="toggleSocialLink(link.id)">
                            {{ link.isActive ? '👁' : '🚫' }}
                          </button>
                          <button class="chip-btn" (click)="editSocialLink(link)">✏️</button>
                          <button class="chip-btn danger" (click)="deleteSocialLink(link.id)">🗑️</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else { <p class="no-content">No social links added yet.</p> }
              </div>
            }

            <!-- ── Payment Details custom UI ── -->
            @if (sec.key === 'payment-details') {
              <div class="panel-card">
                <h3 class="panel-title">Payment Details</h3>
                <div class="field">
                  <label>{{ editingPaymentId ? 'Edit Detail' : 'New Detail' }}</label>
                  <div class="card-fields">
                    <div class="field-inline flex-grow">
                      <label>Key</label>
                      <input type="text" class="input" [(ngModel)]="newPayment.key" placeholder="Phone" />
                    </div>
                    <div class="field-inline flex-grow">
                      <label>Value</label>
                      <input type="text" class="input" [(ngModel)]="newPayment.value" placeholder="+91 98765 43210" />
                    </div>
                    <button class="btn-save-text" (click)="editingPaymentId ? updatePaymentDetail() : addPaymentDetail()"
                      [disabled]="savingPayment()">
                      {{ editingPaymentId ? 'Update' : 'Add' }}
                    </button>
                    @if (editingPaymentId) {
                      <button class="btn-save-text" style="background: transparent; border: 1px solid #444; color: #888;"
                        (click)="cancelEditPayment()">Cancel</button>
                    }
                  </div>
                </div>
                @if (paymentDetails.length) {
                  <div class="img-row">
                    @for (pd of paymentDetails; track pd.id) {
                      <div class="img-chip" [class.inactive]="!pd.isActive">
                        <div class="chip-meta">
                          <span class="chip-key">{{ pd.key }}</span>
                          <span class="chip-order">{{ pd.value }}</span>
                        </div>
                        <div class="chip-actions">
                          <button class="chip-btn" [title]="pd.isActive ? 'Hide' : 'Show'" (click)="togglePaymentDetail(pd.id)">
                            {{ pd.isActive ? '👁' : '🚫' }}
                          </button>
                          <button class="chip-btn" (click)="editPaymentDetail(pd)">✏️</button>
                          <button class="chip-btn danger" (click)="deletePaymentDetail(pd.id)">🗑️</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else { <p class="no-content">No payment details added yet.</p> }
              </div>
            }

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
    .btn-primary { background: #88ad35; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary:hover:not(:disabled) { background: #698927; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }

    .section-tabs { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
    .tab { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 15px; font-size: 12.5px; color: #888; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .tab:hover { color: #f0f0f0; border-color: rgba(255,255,255,0.15); }
    .tab.active { background: rgba(136,173,53,0.12); border-color: rgba(136,173,53,0.3); color: #88ad35; font-weight: 600; }

    .section-panel { display: flex; flex-direction: column; gap: 16px; }
    .panel-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; }
    .panel-title { font-size: 14px; font-weight: 700; color: #f0f0f0; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .panel-sub { font-size: 11.5px; font-weight: 400; color: #555; }
    .panel-desc { font-size: 12.5px; color: #666; margin-bottom: 16px; line-height: 1.5; }

    /* Upload */
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
    .chip-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
    .chip-btn.danger:hover:not(:disabled) { background: rgba(224,84,84,0.15); border-color: rgba(224,84,84,0.2); }
    .chip-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .no-content { font-size: 13px; color: #555; text-align: center; padding: 12px 0; }

    /* Text fields */
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .field-footer { display: flex; align-items: center; gap: 10px; }
    .input { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
    .input:focus { border-color: rgba(136,173,53,0.4); }
    .input-sm { width: 72px; flex-shrink: 0; }
    .textarea { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; resize: vertical; box-sizing: border-box; }
    .textarea:focus { border-color: rgba(136,173,53,0.4); }
    .btn-save-text { background: rgba(136,173,53,0.1); border: 1px solid rgba(136,173,53,0.25); color: #88ad35; border-radius: 7px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; font-family: inherit; }
    .btn-save-text:hover:not(:disabled) { background: rgba(136,173,53,0.18); }
    .btn-save-text:disabled { opacity: 0.5; cursor: not-allowed; }
    .saved-badge { font-size: 11.5px; color: #3dcf8e; font-weight: 600; }
    .field-hint { font-size: 11.5px; color: #555; margin-top: 5px; line-height: 1.5; }
    .hint-code { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 2px 5px; font-family: monospace; font-size: 11px; color: #88ad35; word-break: break-all; display: inline; }

    /* Highlight card editor */
    .cards-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .card-editor { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px; }
    .card-editor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .card-num { font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.07em; }
    .card-editor-actions { display: flex; gap: 5px; }
    .card-fields { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-end; }
    .field-inline { display: flex; flex-direction: column; gap: 5px; }
    .field-inline label { font-size: 12px; font-weight: 600; color: #666; }
    .flex-grow { flex: 1; }
    .cards-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .btn-add-card { background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.15); color: #888; border-radius: 8px; padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .btn-add-card:hover { border-color: #88ad35; color: #88ad35; }

    .spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    .spinner-sm { width: 11px; height: 11px; border: 1.5px solid rgba(255,255,255,0.2); border-top-color: #88ad35; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminHomepageComponent implements OnInit {
  readonly sections = SECTIONS;
  readonly API_BASE = 'https://e-commerce-store-artistric-gift-shop.onrender.com';

  activeSection = signal('hero');
  loading = signal(false);
  globalError = signal('');
  dragSection = signal('');

  allContent = signal<SiteContentSummary[]>([]);

  textValues: Record<string, string> = {};
  savingText = signal<Record<string, boolean>>({});
  savedText = signal<Record<string, boolean>>({});

  // Highlights card editor state
  highlightDrafts: HighlightCard[] = [];
  savingHighlights = signal(false);
  savedHighlights = signal(false);

  private progMap: Record<string, { name: string; done: boolean; error?: string }[]> = {};

  // ── Social Links state ──
  socialLinks: any[] = [];
  savingSocial = signal(false);
  newSocial = { icon: '📸', name: '', url: '' };
  editingSocialId: string | null = null;

  // ── Payment Details state ──
  paymentDetails: any[] = [];
  savingPayment = signal(false);
  newPayment = { key: '', value: '' };
  editingPaymentId: string | null = null;

  constructor(private api: AdminApiService, private appState: AppStateService) {}

  ngOnInit() {
    this.loadAll();
    this.loadSocialLinks();
    this.loadPaymentDetails();
  }

  loadAll() {
    this.loading.set(true);
    this.api.getAllContent().subscribe({
      next: items => {
        this.allContent.set(items);
        items.filter(i => i.kind === 'Text').forEach(i => {
          this.textValues[i.contentKey] = i.textValue ?? '';
        });

        // Load highlight card drafts from the saved DB items
        const cardItems = items
          .filter(i => i.contentKey.startsWith('highlights.card.') && i.kind === 'Text')
          .sort((a, b) => a.sortOrder - b.sortOrder);

        if (cardItems.length > 0) {
          this.highlightDrafts = cardItems.map(i => {
            try { return JSON.parse(i.textValue ?? '{}') as HighlightCard; }
            catch { return { icon: '✨', title: '', body: i.textValue ?? '' }; }
          });
        } else {
          // Seed defaults into the editor (user can save when ready)
          this.highlightDrafts = [
            { icon: '🎁', title: 'Complimentary Gift Wrapping',    body: 'Every order arrives beautifully wrapped, ready to be gifted directly without any extra effort.' },
            { icon: '✨', title: '100% Unique Artisan Designs',    body: 'No factory-produced duplicates. Each piece is crafted in limited numbers by real artisans.' },
            { icon: '🚚', title: 'Fragile-Safe Nationwide Shipping', body: 'Specially packed to protect delicate handmade items during transit, delivered right to your door.' },
            { icon: '💌', title: 'Custom Handwritten Notes',        body: 'Add a personal touch with a handwritten message card included with your order at no extra charge.' },
          ];
        }

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
    if (img.externalImageUrl) return img.externalImageUrl;
    return `${this.API_BASE}/api/content/${img.id}/image`;
  }

  uploadProgress(k: string) { return this.progMap[k] ?? []; }

  triggerFileInput(sectionKey: string) {
    (document.getElementById('fi-' + sectionKey) as HTMLInputElement)?.click();
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
    if (!valid.length) { this.globalError.set('All files exceed 8MB limit.'); return; }
    this.globalError.set('');

    const progress = valid.map(f => ({ name: f.name, done: false }));
    this.progMap[sec.key] = progress;

    const existingMax = this.sectionImages(sec.sectionName)
      .reduce((m, i) => Math.max(m, i.sortOrder), -1);

    valid.forEach((file, idx) => {
      const sortOrder = existingMax + 1 + idx;
      const contentKey = `${sec.sectionName}.image.${sortOrder}`;
      this.api.uploadSectionImage(file, sec.sectionName, contentKey, file.name, sortOrder).subscribe({
        next: () => {
          this.progMap[sec.key] = this.progMap[sec.key].map((p, i) => i === idx ? { ...p, done: true } : p);
          this.api.getAllContent().subscribe(items => {
            this.allContent.set(items);
            this.appState.loadSiteContent();
          });
        },
        error: (err) => {
          this.progMap[sec.key] = this.progMap[sec.key].map((p, i) =>
            i === idx ? { ...p, error: err?.error?.error ?? 'Upload failed' } : p);
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
    this.savingText.update(v => ({ ...v, [key]: true }));
    this.savedText.update(v => ({ ...v, [key]: false }));

    this.api.upsertTextContent(key, sectionName, this.textValues[key] ?? '').subscribe({
      next: () => {
        this.savingText.update(v => ({ ...v, [key]: false }));
        this.savedText.update(v => ({ ...v, [key]: true }));
        setTimeout(() => {
          this.savedText.update(v => ({ ...v, [key]: false }));
        }, 2500);
        this.appState.loadSiteContent();
      },
      error: () => {
        this.savingText.update(v => ({ ...v, [key]: false }));
        this.globalError.set('Failed to save text.');
      }
    });
  }

  // ── Highlight card editor ─────────────────────────────────────────────

  addCard() {
    this.highlightDrafts = [...this.highlightDrafts, { icon: '✨', title: '', body: '' }];
  }

  removeCard(index: number) {
    this.highlightDrafts = this.highlightDrafts.filter((_, i) => i !== index);
  }

  moveCard(index: number, direction: -1 | 1) {
    const arr = [...this.highlightDrafts];
    const target = index + direction;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    this.highlightDrafts = arr;
  }

  saveHighlights() {
    if (this.savingHighlights()) return;
    this.savingHighlights.set(true);
    this.savedHighlights.set(false);
    this.globalError.set('');

    const oldCardItems = this.allContent()
      .filter(i => i.contentKey.startsWith('highlights.card.') && i.kind === 'Text');

    const saves = this.highlightDrafts.map((card, idx) =>
      this.api.upsertTextContent(
        `highlights.card.${idx}`,
        'highlights',
        JSON.stringify(card),
        idx
      )
    );

    const deleteOld = oldCardItems
      .filter(i => {
        const num = parseInt(i.contentKey.split('.').pop() ?? '-1', 10);
        return num >= this.highlightDrafts.length;
      })
      .map(i => this.api.deleteContent(i.id));

    let completed = 0;
    const total = saves.length + deleteOld.length;

    const finish = () => {
      completed++;
      if (completed >= total) {
        this.savingHighlights.set(false);
        this.savedHighlights.set(true);
        setTimeout(() => this.savedHighlights.set(false), 2500);
        this.api.getAllContent().subscribe(items => {
          this.allContent.set(items);
          this.appState.loadSiteContent();
        });
      }
    };

    if (total === 0) {
      this.savingHighlights.set(false);
      return;
    }

    saves.forEach(obs => obs.subscribe({ next: finish, error: finish }));
    deleteOld.forEach(obs => obs.subscribe({ next: finish, error: finish }));
  }

  // ── Social Links CRUD ────────────────────────────────────────────────

  loadSocialLinks() {
    this.api.getSocialLinks().subscribe({
      next: links => this.socialLinks = links,
      error: () => this.globalError.set('Failed to load social links.')
    });
  }

  addSocialLink() {
    if (!this.newSocial.name || !this.newSocial.url) return;
    this.savingSocial.set(true);
    this.api.createSocialLink(this.newSocial.icon, this.newSocial.name, this.newSocial.url).subscribe({
      next: () => {
        this.loadSocialLinks();
        this.newSocial = { icon: '📸', name: '', url: '' };
        this.savingSocial.set(false);
        this.appState.loadSiteContent();
      },
      error: () => {
        this.savingSocial.set(false);
        this.globalError.set('Failed to add social link.');
      }
    });
  }

  editSocialLink(link: any) {
    this.editingSocialId = link.id;
    this.newSocial = { icon: link.icon, name: link.name, url: link.url };
  }

  cancelEditSocial() {
    this.editingSocialId = null;
    this.newSocial = { icon: '📸', name: '', url: '' };
  }

  updateSocialLink() {
    if (!this.editingSocialId || !this.newSocial.name || !this.newSocial.url) return;
    this.savingSocial.set(true);
    this.api.updateSocialLink(this.editingSocialId, this.newSocial).subscribe({
      next: () => {
        this.loadSocialLinks();
        this.cancelEditSocial();
        this.savingSocial.set(false);
        this.appState.loadSiteContent();
      },
      error: () => {
        this.savingSocial.set(false);
        this.globalError.set('Failed to update social link.');
      }
    });
  }

  deleteSocialLink(id: string) {
    this.api.deleteSocialLink(id).subscribe({
      next: () => {
        this.loadSocialLinks();
        this.appState.loadSiteContent();
      },
      error: () => this.globalError.set('Failed to delete social link.')
    });
  }

  toggleSocialLink(id: string) {
    this.api.toggleSocialLink(id).subscribe({
      next: () => {
        this.loadSocialLinks();
        this.appState.loadSiteContent();
      },
      error: () => this.globalError.set('Failed to toggle social link.')
    });
  }

  // ── Payment Details CRUD ─────────────────────────────────────────────

  loadPaymentDetails() {
    this.api.getPaymentDetails().subscribe({
      next: details => this.paymentDetails = details,
      error: () => this.globalError.set('Failed to load payment details.')
    });
  }

  addPaymentDetail() {
    if (!this.newPayment.key || !this.newPayment.value) return;
    this.savingPayment.set(true);
    this.api.createPaymentDetail(this.newPayment.key, this.newPayment.value).subscribe({
      next: () => {
        this.loadPaymentDetails();
        this.newPayment = { key: '', value: '' };
        this.savingPayment.set(false);
        this.appState.loadSiteContent();
        this.appState.loadPaymentDetails();
      },
      error: () => {
        this.savingPayment.set(false);
        this.globalError.set('Failed to add payment detail.');
      }
    });
  }

  editPaymentDetail(pd: any) {
    this.editingPaymentId = pd.id;
    this.newPayment = { key: pd.key, value: pd.value };
  }

  cancelEditPayment() {
    this.editingPaymentId = null;
    this.newPayment = { key: '', value: '' };
  }

  updatePaymentDetail() {
    if (!this.editingPaymentId || !this.newPayment.key || !this.newPayment.value) return;
    this.savingPayment.set(true);
    this.api.updatePaymentDetail(this.editingPaymentId, this.newPayment).subscribe({
      next: () => {
        this.loadPaymentDetails();
        this.cancelEditPayment();
        this.savingPayment.set(false);
        this.appState.loadSiteContent();
        this.appState.loadPaymentDetails();
      },
      error: () => {
        this.savingPayment.set(false);
        this.globalError.set('Failed to update payment detail.');
      }
    });
  }

  deletePaymentDetail(id: string) {
    this.api.deletePaymentDetail(id).subscribe({
      next: () => {
        this.loadPaymentDetails();
        this.appState.loadSiteContent();
        this.appState.loadPaymentDetails();
      },
      error: () => this.globalError.set('Failed to delete payment detail.')
    });
  }

  togglePaymentDetail(id: string) {
    this.api.togglePaymentDetail(id).subscribe({
      next: () => {
        this.loadPaymentDetails();
        this.appState.loadSiteContent();
        this.appState.loadPaymentDetails();
      },
      error: () => this.globalError.set('Failed to toggle payment detail.')
    });
  }
}