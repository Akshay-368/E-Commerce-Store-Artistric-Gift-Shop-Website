import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminCategory } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cat-page">
      <div class="cat-header">
        <div>
          <h1 class="cat-title">Categories</h1>
          <p class="cat-sub">{{ categories().length }} categor{{ categories().length !== 1 ? 'ies' : 'y' }} — used to organise the product catalog</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ New Category</button>
      </div>

      @if (listError()) {
        <div class="alert alert-error">{{ listError() }}</div>
      }

      @if (loading()) {
        <div class="skeleton-list">
          @for (s of [1,2,3,4,5]; track s) { <div class="skeleton-row"></div> }
        </div>
      } @else if (categories().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <p>No categories yet. Create one to start organising your products.</p>
          <button class="btn-primary" (click)="openCreate()">Create first category</button>
        </div>
      } @else {
        <div class="cat-table">
          <div class="cat-table-head">
            <span>Name</span>
            <span>Slug</span>
            <span>Description</span>
            <span class="center">Products</span>
            <span class="center">Status</span>
            <span class="center">Actions</span>
          </div>
          @for (cat of categories(); track cat.id) {
            <div class="cat-row" [class.inactive]="!cat.isActive">
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-slug">{{ cat.slug }}</span>
              <span class="cat-desc">{{ cat.description || '—' }}</span>
              <span class="center cat-count">{{ cat.productCount }}</span>
              <span class="center">
                <span class="badge" [class.active]="cat.isActive">{{ cat.isActive ? 'Active' : 'Inactive' }}</span>
              </span>
              <span class="center cat-actions">
                <button class="btn-icon" title="Edit" (click)="openEdit(cat)">✏️</button>
                <button class="btn-icon danger" title="Delete" (click)="confirmDelete(cat)"
                  [disabled]="cat.productCount > 0" [title]="cat.productCount > 0 ? 'Remove all products first' : 'Delete'">🗑️</button>
              </span>
            </div>
          }
        </div>
      }

      <!-- ═══════════ CREATE / EDIT MODAL ═══════════ -->
      @if (showForm()) {
        <div class="modal-backdrop" (click)="closeForm()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>{{ editingId() ? 'Edit Category' : 'New Category' }}</h3>

            @if (formError()) {
              <div class="alert alert-error" style="margin-bottom:14px">{{ formError() }}</div>
            }

            <div class="field">
              <label>Name *</label>
              <input type="text" [(ngModel)]="form.name" class="input" placeholder="e.g. Home Decor" maxlength="120" />
            </div>
            <div class="field">
              <label>Description</label>
              <input type="text" [(ngModel)]="form.description" class="input" placeholder="Optional short description" maxlength="240" />
            </div>
            @if (editingId()) {
              <div class="field">
                <label class="toggle-label">
                  <input type="checkbox" [(ngModel)]="form.isActive" class="toggle-input" />
                  <span class="toggle-track"></span>
                  <span>{{ form.isActive ? 'Active' : 'Inactive' }}</span>
                </label>
              </div>
            }

            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeForm()" [disabled]="saving()">Cancel</button>
              <button class="btn-primary" (click)="saveCategory()" [disabled]="saving() || !form.name.trim()">
                @if (saving()) { <span class="spinner"></span> Saving… }
                @else { {{ editingId() ? 'Save Changes' : 'Create Category' }} }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════ DELETE CONFIRM ═══════════ -->
      @if (deleteTarget()) {
        <div class="modal-backdrop" (click)="deleteTarget.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Delete Category?</h3>
            <p>Delete <strong>{{ deleteTarget()!.name }}</strong>? Products in this category will become uncategorized.</p>
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
    .cat-page { color: #c0c0c0; font-family: 'Inter', sans-serif; }
    .cat-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .cat-title { font-size: 22px; font-weight: 700; color: #f0f0f0; }
    .cat-sub { font-size: 13px; color: #666; margin-top: 3px; }

    .btn-primary { background: #88ad35; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: #698927; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #1c1c20; color: #c0c0c0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { color: #f0f0f0; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger { background: rgba(224,84,84,0.1); color: #e05454; border: 1px solid rgba(224,84,84,0.25); border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-danger:hover:not(:disabled) { background: rgba(224,84,84,0.2); }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-icon { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 13px; }
    .btn-icon:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
    .btn-icon.danger:hover:not(:disabled) { background: rgba(224,84,84,0.12); }
    .btn-icon:disabled { opacity: 0.35; cursor: not-allowed; }

    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }

    .skeleton-list { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row { height: 48px; border-radius: 8px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .empty-state { text-align: center; padding: 60px 20px; color: #555; }
    .empty-icon { font-size: 40px; margin-bottom: 14px; }
    .empty-state p { margin-bottom: 18px; font-size: 14px; }

    .cat-table { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
    .cat-table-head { display: grid; grid-template-columns: 1.5fr 1fr 2fr 80px 90px 90px; gap: 12px; padding: 11px 18px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
    .cat-row { display: grid; grid-template-columns: 1.5fr 1fr 2fr 80px 90px 90px; gap: 12px; padding: 13px 18px; border-bottom: 1px solid rgba(255,255,255,0.04); align-items: center; transition: background 0.1s; }
    .cat-row:last-child { border-bottom: none; }
    .cat-row:hover { background: rgba(255,255,255,0.02); }
    .cat-row.inactive { opacity: 0.5; }
    .cat-name { font-size: 13.5px; font-weight: 600; color: #f0f0f0; }
    .cat-slug { font-size: 12px; color: #555; font-family: monospace; }
    .cat-desc { font-size: 12.5px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cat-count { font-size: 13px; font-weight: 600; color: #888; }
    .cat-actions { display: flex; gap: 6px; justify-content: center; }
    .center { text-align: center; display: flex; align-items: center; justify-content: center; }
    .badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; background: rgba(255,255,255,0.05); color: #555; }
    .badge.active { background: rgba(61,207,142,0.1); color: #3dcf8e; border: 1px solid rgba(61,207,142,0.2); }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .modal { background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; max-width: 440px; width: 90%; }
    .modal h3 { font-size: 17px; font-weight: 700; color: #f0f0f0; margin-bottom: 18px; }
    .modal p { font-size: 13.5px; color: #888; line-height: 1.6; margin-bottom: 20px; }
    .modal p strong { color: #f0f0f0; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .input { background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: rgba(136,173,53,0.5); }
    .toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #c0c0c0; }
    .toggle-input { display: none; }
    .toggle-track { width: 36px; height: 20px; background: #333; border-radius: 10px; position: relative; flex-shrink: 0; transition: background 0.2s; }
    .toggle-track::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #888; top: 3px; left: 3px; transition: all 0.2s; }
    .toggle-input:checked + .toggle-track { background: #88ad35; }
    .toggle-input:checked + .toggle-track::after { left: 19px; background: #fff; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminCategoriesComponent implements OnInit {
  categories = signal<AdminCategory[]>([]);
  loading = signal(false);
  listError = signal('');
  saving = signal(false);
  deleting = signal(false);
  formError = signal('');
  showForm = signal(false);
  editingId = signal<string | null>(null);
  deleteTarget = signal<AdminCategory | null>(null);

  form = { name: '', description: '', isActive: true };

  constructor(private api: AdminApiService) {}

  ngOnInit() { this.loadCategories(); }

  loadCategories() {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: cats => { this.categories.set(cats); this.loading.set(false); },
      error: () => { this.listError.set('Could not load categories.'); this.loading.set(false); }
    });
  }

  openCreate() {
    this.form = { name: '', description: '', isActive: true };
    this.editingId.set(null);
    this.formError.set('');
    this.showForm.set(true);
  }

  openEdit(cat: AdminCategory) {
    this.form = { name: cat.name, description: cat.description ?? '', isActive: cat.isActive };
    this.editingId.set(cat.id);
    this.formError.set('');
    this.showForm.set(true);
  }

  closeForm() { if (!this.saving()) this.showForm.set(false); }

  saveCategory() {
    if (!this.form.name.trim() || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const obs = id
      ? this.api.updateCategory(id, this.form.name.trim(), this.form.description.trim() || undefined, this.form.isActive)
      : this.api.createCategory(this.form.name.trim(), this.form.description.trim() || undefined);

    obs.subscribe({
      next: (cat) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (id) {
          this.categories.update(prev => prev.map(c => c.id === id ? cat : c));
        } else {
          this.categories.update(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? err?.error?.message ?? 'Failed to save category.');
      }
    });
  }

  confirmDelete(cat: AdminCategory) { this.deleteTarget.set(cat); }

  doDelete() {
    const cat = this.deleteTarget();
    if (!cat) return;
    this.deleting.set(true);
    this.api.deleteCategory(cat.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.categories.update(prev => prev.filter(c => c.id !== cat.id));
      },
      error: (err) => {
        this.deleting.set(false);
        this.listError.set(err?.error?.error ?? 'Failed to delete category.');
        this.deleteTarget.set(null);
      }
    });
  }
}