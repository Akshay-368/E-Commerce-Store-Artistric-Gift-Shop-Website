import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../services/admin-auth.service';

// The three sub-views within the security page
type SecurityView = 'overview' | 'totp-confirm' | 'totp-totp' | 'totp-done';

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sec-page">

      <!-- ── Page header ── -->
      <div class="sec-header">
        <div>
          <h1 class="sec-title">Security</h1>
          <p class="sec-sub">Manage authentication settings for the admin portal</p>
        </div>
      </div>

      @if (globalError()) {
        <div class="alert alert-error">{{ globalError() }}</div>
      }

      <!-- ══════════════════════════════════════════════════════════════
           VIEW 1 — Overview (card grid with toggles)
      ══════════════════════════════════════════════════════════════════ -->
      @if (view() === 'overview') {
        <div class="card-grid">

          <!-- TOTP toggle card -->
          <div class="sec-card">
            <div class="sec-card-icon">{{ totpEnabled() ? '🔐' : '🔓' }}</div>
            <div class="sec-card-body">
              <div class="sec-card-title">Two-Factor Authenticator (TOTP)</div>
              <div class="sec-card-desc">
                @if (totpEnabled()) {
                  Stage 2 of the admin login requires a 6-digit code from your authenticator app.
                  <strong>Currently: ON</strong>
                } @else {
                  The authenticator stage is disabled. Login only requires the access key and password.
                  <strong>Currently: OFF</strong>
                }
              </div>
            </div>
            <div class="sec-card-action">
              <div class="toggle-wrap" [class.on]="totpEnabled()" (click)="startToggle()">
                <div class="toggle-thumb"></div>
              </div>
              <span class="toggle-label">{{ totpEnabled() ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Placeholder card — more settings can go here -->
          <div class="sec-card sec-card-muted">
            <div class="sec-card-icon">🔑</div>
            <div class="sec-card-body">
              <div class="sec-card-title">Pre-auth Access Key</div>
              <div class="sec-card-desc">Set via environment variable <code>ADMINSETTINGS__SECRETPREAUTHKEY</code>. Change it on the server.</div>
            </div>
          </div>

        </div>
      }

      <!-- ══════════════════════════════════════════════════════════════
           VIEW 2 — Confirmation phrase
      ══════════════════════════════════════════════════════════════════ -->
      @if (view() === 'totp-confirm') {
        <div class="flow-card">
          <button class="back-link" type="button" (click)="view.set('overview')">← Back</button>

          <div class="flow-icon">{{ totpEnabled() ? '🔓' : '🔐' }}</div>
          <h2 class="flow-title">
            {{ totpEnabled() ? 'Disable' : 'Enable' }} Authenticator
          </h2>
          <p class="flow-desc">
            This will {{ totpEnabled() ? 'remove' : 'add' }} the TOTP stage from the admin login flow.
            To proceed, type the confirmation phrase <strong>exactly</strong> as shown below.
          </p>

          <div class="phrase-box">{{ expectedPhrase() }}</div>

          <div class="field-group">
            <label class="field-label">Confirmation phrase</label>
            <input class="field-input" type="text" autocomplete="off" spellcheck="false"
              [placeholder]="expectedPhrase()"
              [(ngModel)]="confirmationPhrase"
              (input)="confirmError.set('')" />
            @if (confirmError()) {
              <p class="field-error">{{ confirmError() }}</p>
            }
          </div>

          <button class="btn-primary" type="button"
            (click)="submitConfirmation()"
            [disabled]="!confirmationPhrase.trim()">
            Continue →
          </button>
        </div>
      }

      <!-- ══════════════════════════════════════════════════════════════
           VIEW 3 — TOTP code entry
      ══════════════════════════════════════════════════════════════════ -->
      @if (view() === 'totp-totp') {
        <div class="flow-card">
          <button class="back-link" type="button" (click)="view.set('totp-confirm')">← Back</button>

          <div class="flow-icon">🔢</div>
          <h2 class="flow-title">Enter Authenticator Code</h2>
          <p class="flow-desc">
            Open your authenticator app and enter the current 6-digit code to
            {{ totpEnabled() ? 'disable' : 'enable' }} the TOTP login stage.
          </p>

          @if (cooldownSecs() > 0) {
            <div class="alert alert-warn">
              ⏳ Too many wrong codes. Wait <strong>{{ formatCooldown(cooldownSecs()) }}</strong> before trying again.
            </div>
          }

          <div class="field-group">
            <label class="field-label">6-digit code</label>
            <input class="field-input totp-input" type="text" inputmode="numeric"
              maxlength="6" placeholder="000000" autocomplete="one-time-code"
              [(ngModel)]="totpCode"
              [disabled]="submitting() || cooldownSecs() > 0"
              (input)="totpError.set('')"
              (keydown.enter)="submitToggle()" />
            @if (totpError()) {
              <p class="field-error">{{ totpError() }}</p>
            }
          </div>

          <button class="btn-primary" type="button"
            (click)="submitToggle()"
            [disabled]="totpCode.length < 6 || submitting() || cooldownSecs() > 0">
            @if (submitting()) { <span class="spinner"></span> Verifying… }
            @else if (cooldownSecs() > 0) { ⏳ Wait {{ formatCooldown(cooldownSecs()) }} }
            @else { {{ totpEnabled() ? 'Disable TOTP' : 'Enable TOTP' }} }
          </button>
        </div>
      }

      <!-- ══════════════════════════════════════════════════════════════
           VIEW 4 — Done / success
      ══════════════════════════════════════════════════════════════════ -->
      @if (view() === 'totp-done') {
        <div class="flow-card flow-card-success">
          <div class="flow-icon">✅</div>
          <h2 class="flow-title">Done!</h2>
          <p class="flow-desc">
            @if (totpEnabled()) {
              The authenticator stage is now <strong>enabled</strong>. The next admin login will require a TOTP code.
            } @else {
              The authenticator stage is now <strong>disabled</strong>. Login will only require the access key and password.
            }
          </p>
          <button class="btn-secondary" type="button" (click)="view.set('overview')">← Back to Security</button>
        </div>
      }

    </div>
  `,
  styles: [`
    .sec-page { color: #c0c0c0; font-family: 'Inter', sans-serif; }
    .sec-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .sec-title { font-size: 22px; font-weight: 700; color: #f0f0f0; }
    .sec-sub   { font-size: 13px; color: #666; margin-top: 3px; }

    .alert { border-radius: 10px; padding: 11px 16px; font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(224,84,84,0.08); border: 1px solid rgba(224,84,84,0.2); color: #e05454; }
    .alert-warn  { background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); color: #ffaa44; margin-bottom: 16px; }

    /* ── Card grid (overview) ── */
    .card-grid { display: flex; flex-direction: column; gap: 14px; }
    .sec-card {
      background: #141416; border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px; padding: 20px 22px;
      display: flex; align-items: center; gap: 18px;
    }
    .sec-card-muted { opacity: 0.55; pointer-events: none; }
    .sec-card-icon { font-size: 26px; flex-shrink: 0; }
    .sec-card-body { flex: 1; }
    .sec-card-title { font-size: 14.5px; font-weight: 600; color: #f0f0f0; margin-bottom: 4px; }
    .sec-card-desc  { font-size: 12.5px; color: #666; line-height: 1.55; }
    .sec-card-desc strong { color: #88ad35; }
    .sec-card-desc code { background: rgba(255,255,255,0.06); border-radius: 4px; padding: 1px 5px; font-size: 11.5px; color: #aaa; }
    .sec-card-action { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }

    /* Toggle switch */
    .toggle-wrap {
      width: 48px; height: 26px; border-radius: 13px;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.12);
      position: relative; cursor: pointer; transition: background 0.25s;
    }
    .toggle-wrap.on { background: #88ad35; border-color: #88ad35; }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; transition: left 0.25s;
    }
    .toggle-wrap.on .toggle-thumb { left: 27px; }
    .toggle-label { font-size: 11px; color: #666; }

    /* ── Flow card (confirm / TOTP / done views) ── */
    .flow-card {
      background: #141416; border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px; padding: 32px 36px;
      max-width: 480px; display: flex; flex-direction: column; gap: 18px;
    }
    .flow-card-success { border-color: rgba(61,207,142,0.2); }
    .back-link {
      background: none; border: none; color: #666; font-size: 13px;
      cursor: pointer; padding: 0; font-family: inherit; text-align: left;
    }
    .back-link:hover { color: #aaa; }
    .flow-icon { font-size: 36px; }
    .flow-title { font-size: 18px; font-weight: 700; color: #f0f0f0; }
    .flow-desc  { font-size: 13.5px; color: #888; line-height: 1.6; }
    .flow-desc strong { color: #f0f0f0; }

    /* Phrase box */
    .phrase-box {
      background: rgba(136,173,53,0.08); border: 1.5px dashed rgba(136,173,53,0.35);
      border-radius: 10px; padding: 12px 16px;
      font-family: 'Courier New', monospace; font-size: 13.5px;
      color: #88ad35; letter-spacing: 0.02em; user-select: all;
    }

    /* Fields */
    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 12.5px; font-weight: 600; color: #888; }
    .field-input {
      background: #1c1c20; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 11px 14px; font-size: 14px;
      color: #f0f0f0; font-family: inherit; outline: none;
      transition: border-color 0.15s; width: 100%; box-sizing: border-box;
    }
    .field-input:focus { border-color: rgba(136,173,53,0.5); }
    .field-input:disabled { opacity: 0.45; }
    .totp-input { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 0.4em; font-family: 'Courier New', monospace; }
    .field-error { font-size: 12px; color: #e05454; margin: 0; }

    /* Buttons */
    .btn-primary {
      background: #88ad35; color: #fff; border: none; border-radius: 10px;
      padding: 12px 22px; font-size: 14px; font-weight: 600;
      font-family: inherit; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: #698927; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-secondary {
      background: #1c1c20; color: #c0c0c0;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      padding: 11px 20px; font-size: 13.5px; font-weight: 600;
      font-family: inherit; cursor: pointer;
    }
    .btn-secondary:hover { border-color: rgba(255,255,255,0.2); color: #fff; }

    .spinner {
      width: 15px; height: 15px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminSecurityComponent implements OnInit, OnDestroy {
  view         = signal<SecurityView>('overview');
  totpEnabled  = signal(true);
  globalError  = signal('');

  // Step 2 — confirmation phrase
  confirmationPhrase = '';
  confirmError       = signal('');

  // Step 3 — TOTP code entry
  totpCode   = '';
  totpError  = signal('');
  submitting = signal(false);
  cooldownSecs = signal(0);

  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private auth: AdminAuthService) {}

  ngOnInit() {
    this.auth.getTotpStatus().subscribe({
      next: (res) => this.totpEnabled.set(res.totpEnabled),
      error: ()    => this.globalError.set('Could not fetch TOTP status from server.')
    });
  }

  ngOnDestroy() {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  // The exact phrase the admin must type — changes based on current state
  expectedPhrase = () =>
    this.totpEnabled()
      ? 'I, Admin wants to toggle it off'
      : 'I, Admin wants to toggle it on';

  // ── Toggle entry point (called from the toggle switch click) ─────────
  startToggle() {
    this.confirmationPhrase = '';
    this.totpCode           = '';
    this.confirmError.set('');
    this.totpError.set('');
    this.globalError.set('');
    this.view.set('totp-confirm');
  }

  // ── Step 2: validate the confirmation phrase ─────────────────────────
  submitConfirmation() {
    if (this.confirmationPhrase.trim() !== this.expectedPhrase()) {
      this.confirmError.set(
        `Phrase does not match. Type it exactly as shown.`
      );
      return;
    }
    this.confirmError.set('');
    this.totpCode = '';
    this.view.set('totp-totp');
  }

  // ── Step 3: validate TOTP code and call the toggle API ───────────────
  submitToggle() {
    if (this.totpCode.length < 6 || this.submitting() || this.cooldownSecs() > 0) return;
    this.submitting.set(true);
    this.totpError.set('');

    this.auth.toggleTotp(this.confirmationPhrase.trim(), this.totpCode.trim()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.totpEnabled.set(res.totpEnabled);
        this.totpCode           = '';
        this.confirmationPhrase = '';
        this.view.set('totp-done');
      },
      error: (err) => {
        this.submitting.set(false);
        this.totpCode = '';
        const status = err?.status;
        if (status === 429) {
          const secs: number = err?.error?.retryAfterSeconds ?? 60;
          this.startCooldown(secs);
          this.totpError.set('Too many wrong codes — see cooldown timer above.');
        } else if (status === 403) {
          this.totpError.set('Your IP is temporarily banned due to repeated failures.');
        } else {
          this.totpError.set(
            err?.error?.error ?? 'Invalid authenticator code. Please try again.'
          );
        }
      }
    });
  }

  private startCooldown(secs: number) {
    this.cooldownSecs.set(secs);
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      const next = Math.max(0, this.cooldownSecs() - 1);
      this.cooldownSecs.set(next);
      if (next === 0) {
        clearInterval(this.cooldownInterval!);
        this.cooldownInterval = null;
        this.totpError.set('');
      }
    }, 1000);
  }

  formatCooldown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
}