import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from '../services/admin-api.services';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <h1>Dashboard</h1>
      <p class="subtitle">Activity & Traffic Monitor</p>

      <div class="action-bar">
        <button class="btn" (click)="fetchLogs()" [disabled]="isLoadingLogs()">
          {{ isLoadingLogs() ? 'Loading...' : 'Fetch Activity Logs' }}
        </button>
        <button class="btn" (click)="fetchDbSize()" [disabled]="isLoadingDbSize()">
          {{ isLoadingDbSize() ? 'Loading...' : 'Database Size' }}
        </button>
        <span *ngIf="dbSize()" class="db-size">Database size: {{ dbSize() }}</span>
      </div>

      <div *ngIf="logs().length > 0" class="log-section">
        <div class="table-controls">
          <label>
            <input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll()" />
            Select All
          </label>
          <button class="btn btn-danger" (click)="openDeleteDialog()"
                  [disabled]="selectedIds().size === 0 && !selectAllMode">
            Delete {{ selectAllMode ? 'All' : 'Selected' }} ({{ selectedIds().size }})
          </button>
        </div>

        <table class="log-table">
          <thead>
            <tr>
              <th></th>
              <th>Timestamp (UTC)</th>
              <th>IP</th>
              <th>Forwarded IP</th>
              <th>User Agent</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of logs()">
              <td>
                <input type="checkbox" [checked]="isSelected(log.id)" (change)="toggleSelection(log.id)" />
              </td>
              <td>{{ log.actionDate | date:'medium' }}</td>
              <td>{{ log.remoteIpAddress || '-' }}</td>
              <td>{{ log.forwardedFor || '-' }}</td>
              <td class="ua-cell" [title]="log.userAgent">{{ (log.userAgent?.length > 40 ? (log.userAgent | slice:0:40) + '...' : log.userAgent) || '-' }}</td>
              <td>{{ log.description }}</td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" *ngIf="totalPages() > 1">
          <button (click)="prevPage()" [disabled]="currentPage() === 1">Previous</button>
          <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
          <button (click)="nextPage()" [disabled]="currentPage() >= totalPages()">Next</button>
        </div>
      </div>

      <p *ngIf="logs().length === 0 && !isLoadingLogs()" class="empty">No activity logs yet.</p>

      <!-- Delete Confirmation Dialog (Two‑Step) -->
      <div class="modal-backdrop" *ngIf="showDeleteDialog()">
        <div class="modal">
          <h2>Delete Activity Logs</h2>
          <p class="warning">This action cannot be undone.</p>

          <!-- Step 1: Confirmation Phrase -->
          <ng-container *ngIf="deleteStep() === 1">
            <div class="form-group">
              <label>Confirmation Phrase:</label>
              <p class="phrase-hint">"I confirm, that I as the admin, wants to delete the entries of the activities of the dashboard"</p>
              <input [(ngModel)]="deleteConfirmation" placeholder="Type the exact phrase..." class="input" />
            </div>
            <p *ngIf="deleteError" class="error">{{ deleteError }}</p>
            <div class="dialog-actions">
              <button class="btn" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger" (click)="proceedToTotp()" [disabled]="!deleteConfirmation.trim()">Continue</button>
            </div>
          </ng-container>

          <!-- Step 2: TOTP -->
          <ng-container *ngIf="deleteStep() === 2">
            <div class="form-group">
              <label>TOTP Code:</label>
              <input [(ngModel)]="deleteTotp" placeholder="6‑digit code" maxlength="6" class="input" />
            </div>
            <p *ngIf="deleteError" class="error">
              {{ deleteError }}
              <span *ngIf="cooldownSeconds > 0"> (wait {{ cooldownSeconds }}s)</span>
            </p>
            <div class="dialog-actions">
              <button class="btn" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger" (click)="confirmDelete()" [disabled]="deleteLoading || deleteTotp.length !== 6">
                Confirm Delete
              </button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }
    .dashboard-container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .action-bar { display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; }
    .btn { background: #2c2c32; border: 1px solid #3a3a44; color: #e0e0e0; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; transition: 0.2s; }
    .btn:hover:not(:disabled) { background: #3a3a44; border-color: #555; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger { background: #5a1a1a; border-color: #7a2a2a; color: #ffb0b0; }
    .btn-danger:hover:not(:disabled) { background: #6a2a2a; }
    .db-size { font-weight: 500; color: #88ad35; }
    .log-section { margin-top: 1.5rem; }
    .table-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .table-controls label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .log-table { width: 100%; border-collapse: collapse; background: #141416; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
    .log-table th { background: #1c1c20; padding: 0.8rem 1rem; text-align: left; font-weight: 600; color: #ccc; border-bottom: 1px solid #2a2a2a; }
    .log-table td { padding: 0.7rem 1rem; border-bottom: 1px solid #1a1a1a; color: #ddd; font-size: 0.9rem; }
    .ua-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1rem; }
    .pagination button { background: #2c2c32; border: 1px solid #3a3a44; color: #e0e0e0; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; }
    .empty { text-align: center; color: #666; padding: 3rem; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: #1c1c20; border: 1px solid #333; border-radius: 12px; padding: 2rem; width: 90%; max-width: 550px; color: #e0e0e0; }
    .modal h2 { margin-top: 0; }
    .warning { color: #e0a832; font-size: 0.9rem; margin-bottom: 1rem; }
    .phrase-hint { background: #111; padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; word-break: break-word; margin-bottom: 0.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
    .input { width: 100%; padding: 0.6rem; background: #0d0d0e; border: 1px solid #333; border-radius: 6px; color: #fff; font-size: 0.95rem; outline: none; }
    .input:focus { border-color: #88ad35; }
    .error { color: #e05454; font-size: 0.85rem; margin-top: 0.3rem; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
  `]
})
export class AdminDashboardComponent {
  private api = inject(AdminApiService);
  private auth = inject(AdminAuthService);
  private router = inject(Router);

  logs = signal<any[]>([]);
  isLoadingLogs = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);
  private pageSize = 50;

  selectedIds = signal<Set<string>>(new Set());
  selectAllMode = false;

  dbSize = signal<string | null>(null);
  isLoadingDbSize = signal(false);

  // Delete dialog
  showDeleteDialog = signal(false);
  deleteStep = signal(1);       // 1 = confirmation phrase, 2 = TOTP
  deleteConfirmation = '';
  deleteTotp = '';
  deleteError = '';
  deleteLoading = false;
  cooldownSeconds = 0;
  private cooldownInterval: any = null;

  fetchLogs(page: number = 1) {
    this.isLoadingLogs.set(true);
    this.currentPage.set(page);
    this.api.getActivityLogs(page, this.pageSize).subscribe({
      next: (res: any) => {
        this.logs.set(res.items || []);
        this.totalPages.set(Math.ceil(res.total / this.pageSize));
        this.isLoadingLogs.set(false);
        this.selectedIds.set(new Set());
        this.selectAllMode = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoadingLogs.set(false);
      }
    });
  }

  toggleSelection(id: string) {
    const set = new Set(this.selectedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.selectedIds.set(set);
    // if any deselection, unset selectAllMode
    if (!this.allSelected()) this.selectAllMode = false;
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  allSelected(): boolean {
    return this.logs().length > 0 && this.logs().every(l => this.selectedIds().has(l.id));
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
      this.selectAllMode = false;
    } else {
      const allIds = new Set(this.logs().map(l => l.id));
      this.selectedIds.set(allIds);
      this.selectAllMode = true;
    }
  }

  prevPage() { if (this.currentPage() > 1) this.fetchLogs(this.currentPage() - 1); }
  nextPage() { if (this.currentPage() < this.totalPages()) this.fetchLogs(this.currentPage() + 1); }

  fetchDbSize() {
    this.isLoadingDbSize.set(true);
    this.api.getDatabaseSize().subscribe({
      next: (res) => {
        this.dbSize.set(res.size);
        this.isLoadingDbSize.set(false);
      },
      error: () => this.isLoadingDbSize.set(false)
    });
  }

  openDeleteDialog() {
    this.deleteConfirmation = '';
    this.deleteTotp = '';
    this.deleteError = '';
    this.deleteStep.set(1);
    this.showDeleteDialog.set(true);
  }

  cancelDelete() {
    this.showDeleteDialog.set(false);
    clearInterval(this.cooldownInterval);
  }

  proceedToTotp() {
    const expected = "I confirm, that I as the admin, wants to delete the entries of the activities of the dashboard";
    if (this.deleteConfirmation.trim() !== expected) {
      this.deleteError = 'Confirmation phrase does not match exactly.';
      return;
    }
    this.deleteError = '';
    this.deleteStep.set(2);
  }

  confirmDelete() {
    this.deleteLoading = true;
    this.deleteError = '';
    clearInterval(this.cooldownInterval);
    this.cooldownSeconds = 0;

    const idsArray = this.selectAllMode ? null : Array.from(this.selectedIds());
    this.api.deleteActivityLogs(idsArray, this.deleteTotp, this.deleteConfirmation).subscribe({
      next: (res) => {
        this.deleteLoading = false;
        this.showDeleteDialog.set(false);
        this.fetchLogs(this.currentPage());
      },
      error: (err) => {
        this.deleteLoading = false;
        if (err.status === 403) {
          this.deleteError = 'Banned. Logging out...';
          this.auth.logout();
          this.router.navigate(['/admin/login']);
        } else if (err.status === 429) {
          const secs = err.error?.retryAfterSeconds || 0;
          this.deleteError = 'Cooldown active. Please wait.';
          this.startCooldown(secs);
        } else {
          this.deleteError = err.error?.message || err.error?.error || 'Deletion failed.';
        }
      }
    });
  }

  private startCooldown(seconds: number) {
    this.cooldownSeconds = seconds;
    clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownInterval);
        this.deleteError = '';
      }
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.cooldownInterval);
  }
}