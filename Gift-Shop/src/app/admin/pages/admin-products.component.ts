import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { AdminApiService, AdminCategory, AdminProduct, AdminProductImage } from '../services/admin-api.services';

type Mode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ap-page">

      <!-- ═══════════ LIST VIEW ═══════════ -->
      @if (mode() === 'list') {
        <div class="ap-header">
          <div>
            <h1 class="ap-title">Products</h1>
            <p class="ap-sub">{{ products().length }} product{{ products().length !== 1 ? 's' : '' }} in catalog</p>
          </div>
          <button class="btn-primary" (click)="openCreate()">+ Add Product</button>
        </div>

        @if (listError()) {
          <div class="alert alert-error">{{ listError() }}</div>
        }

        @if (loading()) {
          <div class="skeleton-grid">
            @for (s of [1,2,3,4,5,6]; track s) {
              <div class="skeleton-card"></div>
            }
          </div>
        } @else if (products().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <p>No products yet.</p>
            <button class="btn-primary" (click)="openCreate()">Create your first product</button>
          </div>
        } @else {
          <div class="product-grid">
            @for (p of products(); track p.id) {
              <div class="product-card" [class.inactive]="!p.isActive">
                <div class="card-img-wrap">
                  @if (primaryImage(p); as img) {
                    <img [src]="img.optimizedUrl || img.imageUrl" [alt]="p.title" class="card-img" />
                  } @else {
                    <div class="card-img-placeholder">📷</div>
                  }
                  <span class="card-status-dot" [class.active]="p.isActive"></span>
                </div>
                <div class="card-body">
                  <div class="card-title">{{ p.title }}</div>
                  <div class="card-price">₹{{ p.price | number }}</div>
                  <div class="card-cat">{{ p.categoryName || 'Uncategorized' }}</div>
                  <div class="card-imgs-count">{{ p.images.length }} image{{ p.images.length !== 1 ? 's' : '' }}</div>
                </div>
                <div class="card-actions">
                  <button class="btn-icon" title="Edit" (click)="openEdit(p)">✏️</button>
                  <button class="btn-icon danger" title="Delete" (click)="confirmDelete(p)">🗑️</button>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- ═══════════ CREATE / EDIT FORM ═══════════ -->
      @if (mode() === 'create' || mode() === 'edit') {
        <div class="form-page">
          <div class="form-header">
            <button class="back-btn" (click)="backToList()">← Back to Products</button>
            <h1 class="ap-title">{{ mode() === 'create' ? 'New Product' : 'Edit Product' }}</h1>
          </div>

          @if (formError()) {
            <div class="alert alert-error">{{ formError() }}</div>
          }
          @if (formSuccess()) {
            <div class="alert alert-success">{{ formSuccess() }}</div>
          }

          <div class="form-layout">
            <!-- ── Left: Details ── -->
            <div class="form-left">
              <div class="form-card">
                <h3 class="form-section-title">Product Details</h3>

                <div class="field">
                  <label>Product Name *</label>
                  <input type="text" [(ngModel)]="form.title" placeholder="e.g. Hand-Blown Botanical Vase"
                    class="input" maxlength="160" />
                </div>

                <div class="field">
                  <label>Short Description <span class="opt">(shown on catalog card)</span></label>
                  <input type="text" [(ngModel)]="form.shortDescription" placeholder="One-line teaser..."
                    class="input" maxlength="120" />
                </div>

                <div class="field">
                  <label>Full Description *</label>
                  <textarea [(ngModel)]="form.description" placeholder="Detailed product description..."
                    class="textarea" rows="5" maxlength="1000"></textarea>
                  <span class="char-count">{{ form.description.length }}/1000</span>
                </div>

                <!-- ── Category dropdown ── -->
                <div class="field">
                  <label>Category</label>
                  @if (categoriesLoading()) {
                    <div class="categories-loading">Loading categories…</div>
                  } @else {
                    <select [(ngModel)]="form.categoryId" class="input select-input">
                      <option value="">— Uncategorized —</option>
                      @for (cat of categories(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                    @if (categories().length === 0) {
                      <p class="field-hint-warn">No categories found. <a class="link" routerLink="/admin/categories">Create one first</a>.</p>
                    }
                  }
                </div>

                <div class="field-row">
                  <div class="field">
                    <label>Price (₹) *</label>
                    <input type="number" [(ngModel)]="form.price" placeholder="0"
                      class="input" min="0" step="0.01" />
                  </div>
                  <div class="field">
                    <label>Sort Order</label>
                    <input type="number" [(ngModel)]="form.sortOrder" class="input" min="0" />
                  </div>
                </div>

                @if (mode() === 'edit') {
                  <div class="field">
                    <label class="toggle-label">
                      <input type="checkbox" [(ngModel)]="form.isActive" class="toggle-input" />
                      <span class="toggle-track"></span>
                      <span>{{ form.isActive ? 'Active (visible to customers)' : 'Inactive (hidden from catalog)' }}</span>
                    </label>
                  </div>
                }
              </div>

              <div class="form-actions">
                <button class="btn-secondary" (click)="backToList()" [disabled]="saving()">Cancel</button>
                <button class="btn-primary" (click)="saveProduct()" [disabled]="saving() || !isFormValid()">
                  @if (saving()) { <span class="spinner"></span> Saving… }
                  @else { {{ mode() === 'create' ? 'Create Product' : 'Save Changes' }} }
                </button>
              </div>
            </div>

            <!-- ── Right: Images ── -->
            <div class="form-right">
              <div class="form-card">
                <h3 class="form-section-title">
                  Product Images
                  @if (mode() === 'create') {
                    <span class="hint-tag">Save product first to upload images</span>
                  }
                </h3>

                @if (mode() === 'edit' && editingProduct()) {
                  <!-- Upload zone -->
                  <div class="upload-zone"
                    [class.dragover]="isDragOver()"
                    (dragover)="$event.preventDefault(); isDragOver.set(true)"
                    (dragleave)="isDragOver.set(false)"
                    (drop)="onDrop($event)"
                    (click)="fileInput.click()">
                    <input #fileInput type="file" accept="image/jpeg,image/png,image/webp"
                      multiple style="display:none" (change)="onFilesSelected($event)" />
                    <div class="upload-icon">📤</div>
                    <p class="upload-label">Drop images here or <strong>click to browse</strong></p>
                    <p class="upload-hint">JPEG, PNG, WebP · Max 8MB each · Up to 10 images</p>
                  </div>

                  @if (uploadProgress().length > 0) {
                    <div class="upload-progress-list">
                      @for (up of uploadProgress(); track up.name) {
                        <div class="upload-progress-item" [class.done]="up.done" [class.error]="up.error">
                          <span class="up-name">{{ up.name }}</span>
                          @if (up.done) { <span class="up-status done">✓</span> }
                          @else if (up.error) { <span class="up-status error">✗ {{ up.error }}</span> }
                          @else { <span class="up-status uploading"><span class="spinner-sm"></span></span> }
                        </div>
                      }
                    </div>
                  }

                  <!-- Image gallery -->
                  @if (editingProduct()!.images.length > 0) {
                    <div class="img-gallery">
                      @for (img of editingProduct()!.images; track img.id) {
                        <div class="img-tile" [class.primary]="img.isPrimary">
                          <img [src]="img.optimizedUrl || img.imageUrl" [alt]="img.altText || 'Product image'" />
                          <div class="img-tile-overlay">
                            @if (!img.isPrimary) {
                              <button class="img-action" title="Set as primary" (click)="setPrimary(img)">⭐</button>
                            } @else {
                              <span class="primary-badge">Primary</span>
                            }
                            <button class="img-action danger" title="Delete image" (click)="deleteImage(img)">🗑️</button>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="no-images-hint">No images yet. Upload some above.</p>
                  }
                }

                @if (mode() === 'create') {
                  <div class="create-first-hint">
                    <p>After creating the product, you'll be able to upload images here.</p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════ DELETE CONFIRM ═══════════ -->
      @if (deleteTarget()) {
        <div class="modal-backdrop" (click)="deleteTarget.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Delete Product?</h3>
            <p>Are you sure you want to delete <strong>{{ deleteTarget()!.title }}</strong>? This will also remove all its images from Cloudinary. This cannot be undone.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="deleteTarget.set(null)">Cancel</button>
              <button class="btn-danger" (click)="doDelete()" [disabled]="deleting()">
                @if (deleting()) { <span class="spinner"></span> Deleting… }
                @else { Delete }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .ap-page { padding: 0; color: #c0c0c0; font-family: 'Inter', sans-serif; }
    .ap-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .ap-title { font-size: 22px; font-weight: 700; color: #f0f0f0; }
    .ap-sub { font-size: 13px; color: #666; margin-top: 3px; }

    /* Buttons */
    .btn-primary { background: #88ad35; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: #698927; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #1c1c20; color: #c0c0c0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: #f0f0f0; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger { background: rgba(224,84,84,0.1); color: #e05454; border: 1px solid rgba(224,84,84,0.25); border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
    .btn-danger:hover:not(:disabled) { background: rgba(224,84,84,0.2); }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-icon { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
    .btn-icon:hover { background: rgba(255,255,255,0.09); }
    .btn-icon.danger:hover { background: rgba(224,84,84,0.12); border-color: rgba(224,84,84,0.2); }
    .back-btn { background: none; border: none; color: #666; font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 10px; display: block; font-family: inherit; }
    .back-btn:hover { color: #aaa; }

    /* Alerts */
    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }
    .alert-success { background: rgba(61,207,142,0.08); border: 1px solid rgba(61,207,142,0.2); color: #3dcf8e; }

    /* Skeleton */
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .skeleton-card { height: 260px; border-radius: 12px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Product grid */
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .product-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s; }
    .product-card:hover { border-color: rgba(255,255,255,0.13); }
    .product-card.inactive { opacity: 0.55; }
    .card-img-wrap { position: relative; aspect-ratio: 4/3; background: #1c1c20; overflow: hidden; }
    .card-img { width: 100%; height: 100%; object-fit: cover; }
    .card-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #444; }
    .card-status-dot { position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: #555; border: 1.5px solid #141416; }
    .card-status-dot.active { background: #3dcf8e; }
    .card-body { padding: 12px 14px; flex: 1; }
    .card-title { font-size: 14px; font-weight: 600; color: #f0f0f0; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-price { font-size: 15px; font-weight: 700; color: #88ad35; margin-bottom: 4px; }
    .card-cat { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-imgs-count { font-size: 11.5px; color: #444; margin-top: 3px; }
    .card-actions { display: flex; gap: 6px; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.05); }

    /* Empty state */
    .empty-state { text-align: center; padding: 60px 20px; color: #555; }
    .empty-icon { font-size: 40px; margin-bottom: 14px; }
    .empty-state p { margin-bottom: 18px; font-size: 14px; }

    /* Form page */
    .form-page { }
    .form-header { margin-bottom: 20px; }
    .form-layout { display: grid; grid-template-columns: 1fr 420px; gap: 20px; align-items: start; }
    .form-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 22px; }
    .form-section-title { font-size: 14px; font-weight: 700; color: #f0f0f0; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
    .hint-tag { font-size: 11px; font-weight: 500; color: #555; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 20px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .opt { font-weight: 400; color: #555; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .input { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: rgba(136,173,53,0.5); }
    .select-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; cursor: pointer; padding-right: 34px; }
    .select-input option { background: #1c1c20; color: #f0f0f0; }
    .textarea { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; resize: vertical; }
    .textarea:focus { border-color: rgba(136,173,53,0.5); }
    .char-count { font-size: 11px; color: #555; text-align: right; }
    .categories-loading { font-size: 13px; color: #555; padding: 10px 0; }
    .field-hint-warn { font-size: 11.5px; color: #ff9944; margin-top: 4px; }
    .link { color: #88ad35; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #c0c0c0; }
    .toggle-input { display: none; }
    .toggle-track { width: 36px; height: 20px; background: #333; border-radius: 10px; position: relative; flex-shrink: 0; transition: background 0.2s; }
    .toggle-track::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #888; top: 3px; left: 3px; transition: all 0.2s; }
    .toggle-input:checked + .toggle-track { background: #88ad35; }
    .toggle-input:checked + .toggle-track::after { left: 19px; background: #fff; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

    /* Upload zone */
    .upload-zone { border: 2px dashed rgba(255,255,255,0.1); border-radius: 10px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 14px; }
    .upload-zone:hover, .upload-zone.dragover { border-color: #88ad35; background: rgba(136,173,53,0.04); }
    .upload-icon { font-size: 24px; margin-bottom: 8px; }
    .upload-label { font-size: 13px; color: #888; margin-bottom: 4px; }
    .upload-label strong { color: #88ad35; }
    .upload-hint { font-size: 11.5px; color: #555; }
    .upload-progress-list { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
    .upload-progress-item { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border-radius: 6px; padding: 7px 10px; font-size: 12.5px; }
    .up-name { color: #888; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .up-status.done { color: #3dcf8e; }
    .up-status.error { color: #e05454; }
    .up-status.uploading { display: flex; align-items: center; }
    .spinner-sm { width: 12px; height: 12px; border: 1.5px solid rgba(255,255,255,0.2); border-top-color: #88ad35; border-radius: 50%; animation: spin 0.7s linear infinite; }

    /* Image gallery */
    .img-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .img-tile { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid transparent; }
    .img-tile.primary { border-color: #88ad35; }
    .img-tile img { width: 100%; height: 100%; object-fit: cover; }
    .img-tile-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); opacity: 0; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .img-tile:hover .img-tile-overlay { opacity: 1; }
    .img-action { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 14px; color: #fff; }
    .img-action.danger:hover { background: rgba(224,84,84,0.4); border-color: rgba(224,84,84,0.5); }
    .primary-badge { background: rgba(136,173,53,0.8); color: #fff; font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 4px; }
    .no-images-hint { font-size: 13px; color: #555; text-align: center; padding: 16px 0; }
    .create-first-hint { background: rgba(255,255,255,0.03); border-radius: 8px; padding: 16px; text-align: center; font-size: 13px; color: #555; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .modal { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; max-width: 400px; width: 90%; }
    .modal h3 { font-size: 17px; font-weight: 700; color: #f0f0f0; margin-bottom: 10px; }
    .modal p { font-size: 13.5px; color: #888; line-height: 1.6; margin-bottom: 20px; }
    .modal p strong { color: #f0f0f0; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 900px) { .form-layout { grid-template-columns: 1fr; } }
  `]
})
export class AdminProductsComponent implements OnInit {
  mode = signal<Mode>('list');
  products = signal<AdminProduct[]>([]);
  categories = signal<AdminCategory[]>([]);
  categoriesLoading = signal(false);
  loading = signal(false);
  listError = signal('');
  saving = signal(false);
  deleting = signal(false);
  formError = signal('');
  formSuccess = signal('');
  deleteTarget = signal<AdminProduct | null>(null);
  editingProduct = signal<AdminProduct | null>(null);
  isDragOver = signal(false);
  uploadProgress = signal<{ name: string; done: boolean; error?: string }[]>([]);

  form = {
    title: '',
    description: '',
    shortDescription: '',
    price: 0,
    sortOrder: 0,
    isActive: true,
    categoryId: '',   // empty string means "no category selected"
  };

  constructor(private api: AdminApiService, private appState: AppStateService) {}

  ngOnInit() {
    this.loadProducts();
    this.loadCategories();
  }

  loadProducts() {
    this.loading.set(true);
    this.listError.set('');
    this.api.getProducts().subscribe({
      next: res => { this.products.set(res.items ?? res as any); this.loading.set(false); },
      error: () => { this.listError.set('Could not load products. Is the backend running?'); this.loading.set(false); }
    });
  }

  loadCategories() {
    this.categoriesLoading.set(true);
    this.api.getCategories().subscribe({
      next: cats => { this.categories.set(cats.filter(c => c.isActive)); this.categoriesLoading.set(false); },
      error: () => { this.categoriesLoading.set(false); } // non-fatal
    });
  }

  primaryImage(p: AdminProduct): AdminProductImage | null {
    return p.images.find(i => i.isPrimary) ?? p.images[0] ?? null;
  }

  openCreate() {
    this.form = { title: '', description: '', shortDescription: '', price: 0, sortOrder: 0, isActive: true, categoryId: '' };
    this.formError.set(''); this.formSuccess.set('');
    this.editingProduct.set(null);
    this.uploadProgress.set([]);
    this.mode.set('create');
  }

  openEdit(p: AdminProduct) {
    this.form = {
      title: p.title,
      description: p.description,
      shortDescription: p.shortDescription ?? '',
      price: p.price,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      categoryId: p.categoryId ?? '',
    };
    this.formError.set(''); this.formSuccess.set('');
    this.editingProduct.set({ ...p, images: [...p.images] });
    this.uploadProgress.set([]);
    this.mode.set('edit');
  }

  backToList() {
    this.mode.set('list');
    this.loadProducts();
  }

  isFormValid(): boolean {
    return this.form.title.trim().length > 0 &&
           this.form.description.trim().length > 0 &&
           this.form.price >= 0;
  }

  saveProduct() {
    if (!this.isFormValid() || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.formSuccess.set('');

    // Convert empty string to undefined so the backend treats it as "no category"
    const categoryId = this.form.categoryId || undefined;

    if (this.mode() === 'create') {
      this.api.createProduct({
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        shortDescription: this.form.shortDescription.trim() || undefined,
        price: this.form.price,
        sortOrder: this.form.sortOrder,
        categoryId,
      }).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.formSuccess.set('Product created! You can now upload images.');
          this.editingProduct.set({ ...created, images: created.images ?? [] });
          this.mode.set('edit');
          // Asynchronously refresh the public catalog cache
          this.appState.loadProducts();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err?.error?.error ?? err?.error?.message ?? 'Failed to create product.');
        }
      });
    } else {
      const p = this.editingProduct()!;
      this.api.updateProduct(p.id, {
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        shortDescription: this.form.shortDescription.trim() || undefined,
        price: this.form.price,
        isActive: this.form.isActive,
        sortOrder: this.form.sortOrder,
        categoryId,
      }).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.formSuccess.set('Changes saved successfully.');
          this.editingProduct.set({ ...updated, images: this.editingProduct()!.images });
          // Asynchronously refresh the public catalog cache
          this.appState.loadProducts();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err?.error?.error ?? err?.error?.message ?? 'Failed to save changes.');
        }
      });
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.uploadFiles(Array.from(input.files));
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) this.uploadFiles(files);
  }

  uploadFiles(files: File[]) {
    const productId = this.editingProduct()?.id;
    if (!productId) return;

    const MAX = 8 * 1024 * 1024;
    const validFiles = files.filter(f => {
      if (f.size > MAX) {
        this.formError.set(`"${f.name}" exceeds 8 MB limit.`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    const progress = validFiles.map(f => ({ name: f.name, done: false }));
    this.uploadProgress.set(progress);

    validFiles.forEach((file, idx) => {
      const isFirst = this.editingProduct()!.images.length === 0 && idx === 0;
      this.api.uploadProductImage(productId, file, isFirst).subscribe({
        next: (img) => {
          const ep = this.editingProduct()!;
          this.editingProduct.set({ ...ep, images: [...ep.images, img] });
          this.uploadProgress.update(prev => prev.map((p, i) => i === idx ? { ...p, done: true } : p));
          this.appState.loadProducts();
        },
        error: (err) => {
          this.uploadProgress.update(prev => prev.map((p, i) => i === idx ? { ...p, error: err?.error?.error ?? 'Upload failed' } : p));
        }
      });
    });
  }

  deleteImage(img: AdminProductImage) {
    const p = this.editingProduct()!;
    this.api.deleteProductImage(p.id, img.id).subscribe({
      next: () => {
        this.editingProduct.set({ ...p, images: p.images.filter(i => i.id !== img.id) });
        this.appState.loadProducts();
      },
      error: () => this.formError.set('Failed to delete image.')
    });
  }

  setPrimary(img: AdminProductImage) {
    const p = this.editingProduct()!;
    this.api.setPrimaryImage(p.id, img.id).subscribe({
      next: () => {
        this.editingProduct.set({ ...p, images: p.images.map(i => ({ ...i, isPrimary: i.id === img.id })) });
        this.appState.loadProducts();
      },
      error: () => this.formError.set('Failed to set primary image.')
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────

  confirmDelete(p: AdminProduct) { this.deleteTarget.set(p); }

  doDelete() {
    const p = this.deleteTarget();
    if (!p) return;
    this.deleting.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.products.update(prev => prev.filter(x => x.id !== p.id));
        this.appState.loadProducts();
      },
      error: () => { this.deleting.set(false); this.listError.set('Failed to delete product.'); this.deleteTarget.set(null); }
    });
  }
}