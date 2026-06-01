import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-bg">
        <div class="grid-overlay"></div>
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
      </div>

      <div class="login-card">
        <div class="login-header">
          <div class="login-brand">
            <span class="brand-icon">⬡</span>
          </div>
          <h1>Admin Portal</h1>
          <p>Kalakaari Gifting — Internal Access Only</p>
        </div>

        @if (errorMsg()) {
          <div class="login-alert" [class.locked]="isLocked()">
            <span>{{ isLocked() ? '🔒' : '⚠' }}</span>
            <span>{{ errorMsg() }}</span>
          </div>
        }

        <div class="login-form">
          <div class="field-group">
            <label class="field-label">Username</label>
            <div class="field-wrap">
              <span class="field-icon">◉</span>
              <input
                type="text"
                class="field-input"
                placeholder="admin"
                [(ngModel)]="username"
                [disabled]="isLocked() || loading()"
                (keydown.enter)="doLogin()"
                autocomplete="username"
              />
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Password</label>
            <div class="field-wrap">
              <span class="field-icon">◈</span>
              <input
                [type]="showPass() ? 'text' : 'password'"
                class="field-input"
                placeholder="••••••••"
                [(ngModel)]="password"
                [disabled]="isLocked() || loading()"
                (keydown.enter)="doLogin()"
                autocomplete="current-password"
              />
              <button class="show-pass-btn" (click)="showPass.update(v => !v)" tabindex="-1">
                {{ showPass() ? '◎' : '◉' }}
              </button>
            </div>
          </div>

          <button
            class="login-btn"
            (click)="doLogin()"
            [disabled]="isLocked() || loading() || !username || !password"
          >
            @if (loading()) {
              <span class="spinner"></span>
              Authenticating…
            } @else {
              Sign In →
            }
          </button>
        </div>

        <div class="login-footer">
          <span class="security-note">🔒 This portal is not publicly accessible</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', 'DM Sans', system-ui, sans-serif;
    }

    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0d0d0e;
      position: relative;
      overflow: hidden;
    }

    .login-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .gradient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
    }

    .orb-1 {
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(136,173,53,0.15) 0%, transparent 70%);
      top: -100px;
      right: -100px;
    }

    .orb-2 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(61,143,240,0.08) 0%, transparent 70%);
      bottom: -50px;
      left: -50px;
    }

    .login-card {
      position: relative;
      width: 100%;
      max-width: 400px;
      background: #141416;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
      margin: 20px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 28px;
    }

    .login-brand {
      width: 52px;
      height: 52px;
      background: rgba(136,173,53,0.12);
      border: 1px solid rgba(136,173,53,0.25);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 22px;
      color: #88ad35;
    }

    .login-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #f0f0f0;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .login-header p {
      font-size: 12.5px;
      color: #555;
    }

    .login-alert {
      background: rgba(224,84,84,0.08);
      border: 1px solid rgba(224,84,84,0.25);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #e05454;
      margin-bottom: 20px;
    }

    .login-alert.locked {
      background: rgba(224,168,50,0.08);
      border-color: rgba(224,168,50,0.25);
      color: #e0a832;
    }

    .login-form { display: flex; flex-direction: column; gap: 16px; }

    .field-group { display: flex; flex-direction: column; gap: 6px; }

    .field-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #888;
    }

    .field-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1c1c20;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 10px 14px;
      transition: border-color 0.15s;
    }

    .field-wrap:focus-within {
      border-color: #88ad35;
    }

    .field-icon {
      color: #555;
      font-size: 14px;
      flex-shrink: 0;
    }

    .field-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: #f0f0f0;
      font-size: 14px;
      font-family: inherit;
    }

    .field-input::placeholder { color: #3a3a3a; }
    .field-input:disabled { opacity: 0.5; }

    .show-pass-btn {
      background: none;
      border: none;
      color: #555;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      line-height: 1;
    }

    .show-pass-btn:hover { color: #888; }

    .login-btn {
      width: 100%;
      padding: 12px;
      background: #88ad35;
      border: none;
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      margin-top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.15s;
    }

    .login-btn:hover:not(:disabled) { background: #698927; }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .login-footer {
      margin-top: 24px;
      text-align: center;
    }

    .security-note {
      font-size: 11.5px;
      color: #444;
    }
  `]
})
export class AdminLoginComponent {
  username = '';
  password = '';
  showPass = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  isLocked = signal(false);

  constructor(private auth: AdminAuthService, private router: Router) {
    const lockRemaining = this.auth.getLockoutRemaining();
    if (lockRemaining > 0) {
      this.isLocked.set(true);
      const mins = Math.ceil(lockRemaining / 60000);
      this.errorMsg.set(`Too many failed attempts. Try again in ${mins} minute(s).`);
    }
  }

  doLogin() {
    if (!this.username || !this.password || this.isLocked() || this.loading()) return;
    this.loading.set(true);
    this.errorMsg.set('');

    setTimeout(() => {
      const result = this.auth.login(this.username, this.password);
      this.loading.set(false);
      if (result === 'locked') {
        this.isLocked.set(true);
        this.errorMsg.set('Account locked due to too many attempts. Try again in 15 minutes.');
      } else if (!result) {
        this.errorMsg.set('Invalid username or password. Please try again.');
        this.password = '';
      } else {
        this.router.navigate(['/admin/dashboard']);
      }
    }, 600);
  }
}
