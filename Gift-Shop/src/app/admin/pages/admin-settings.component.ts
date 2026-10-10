import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="settings-header">
        <h1>Settings</h1>
        <p>Configure store-wide settings including shipping strategy and external services.</p>
      </div>

      @if (loading()) {
        <div class="skeleton-block"></div>
      } @else {
        <div class="settings-card">
          <h2>Shipping Strategy</h2>
          <p class="subtitle">Determine how shipping fees are calculated for customers.</p>
          
          <div class="field">
            <label>Strategy Type</label>
            <select [ngModel]="shippingStrategy()" (ngModelChange)="shippingStrategy.set($event)" class="input">
              <option value="Free">Free Shipping</option>
              <option value="FlatRate">Flat Rate</option>
              <option value="Dynamic">Dynamic (Third Party APIs / Weight based)</option>
            </select>
          </div>

          @if (shippingStrategy() === 'FlatRate') {
            <div class="field">
              <label>Flat Rate Amount (₹)</label>
              <input type="number" [ngModel]="flatShippingRate()" (ngModelChange)="flatShippingRate.set($event)" class="input" placeholder="e.g. 50" min="0" step="1" />
            </div>
          }
          
          @if (error()) {
            <div class="alert alert-error">{{ error() }}</div>
          }
          @if (success()) {
            <div class="alert alert-success">{{ success() }}</div>
          }

          <div class="actions">
            <button class="btn-primary" (click)="saveSettings()" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner"></span> Saving...
              } @else {
                Save Settings
              }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-page { padding: 0; color: #c0c0c0; font-family: 'Inter', sans-serif; }
    .settings-header { margin-bottom: 24px; }
    .settings-header h1 { font-size: 22px; font-weight: 700; color: #f0f0f0; margin-bottom: 4px; }
    .settings-header p { font-size: 13px; color: #666; }
    
    .settings-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 22px; max-width: 600px; margin-bottom: 20px; }
    .settings-card h2 { font-size: 16px; font-weight: 600; color: #f0f0f0; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #888; margin-bottom: 20px; }
    
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field label { font-size: 12.5px; font-weight: 600; color: #888; }
    .input { background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: #f0f0f0; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: rgba(136,173,53,0.5); }
    
    .btn-primary { background: #88ad35; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: #698927; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .actions { display: flex; justify-content: flex-end; margin-top: 24px; }
    
    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-top: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }
    .alert-success { background: rgba(61,207,142,0.08); border: 1px solid rgba(61,207,142,0.2); color: #3dcf8e; }
    
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .skeleton-block { height: 300px; background: linear-gradient(90deg, #1c1c20 25%, #222226 50%, #1c1c20 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 12px; max-width: 600px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `]
})
export class AdminSettingsComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  shippingStrategy = signal('Free');
  flatShippingRate = signal('0');

  constructor(private api: AdminApiService) {}

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.api.getSettings().subscribe({
      next: (settings) => {
        this.shippingStrategy.set(settings['ShippingStrategy'] || 'Free');
        this.flatShippingRate.set(settings['FlatShippingRate'] || '0');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load settings.');
        this.loading.set(false);
      }
    });
  }

  saveSettings() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    const payload = {
      ShippingStrategy: String(this.shippingStrategy()),
      FlatShippingRate: String(this.flatShippingRate())
    };

    this.api.updateSettings(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Settings saved successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set('Failed to save settings.');
      }
    });
  }
}
