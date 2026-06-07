import { CommonModule } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

type Stage = 'preauth' | 'login';

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
          <div class="login-brand"><span class="brand-icon">⬡</span></div>
          <h1>Admin Portal</h1>
          <p>Kalakaari Gifting — Internal Access Only</p>
        </div>

        <!-- Stage indicator -->
        <div class="stage-indicator">
          <div class="stage-step" [class.active]="stage() === 'preauth'" [class.done]="stage() === 'login'">
            <span class="step-num">{{ stage() === 'login' ? '✓' : '1' }}</span>
            <span>Access Key</span>
          </div>
          <div class="stage-divider"></div>
          <div class="stage-step" [class.active]="stage() === 'login'">
            <span class="step-num">2</span>
            <span>Credentials</span>
          </div>
        </div>

        @if (errorMsg()) {
          <div class="login-alert">
            <span>⚠</span><span>{{ errorMsg() }}</span>
          </div>
        }
        @if (successMsg()) {
          <div class="login-success">
            <span>✓</span><span>{{ successMsg() }}</span>
          </div>
        }

        <!-- FIX: Live cooldown countdown banner -->
        @if (cooldownSecs() > 0) {
          <div class="login-cooldown">
            <span>⏳</span>
            <span>Too many failed attempts. Try again in <strong>{{ formatCooldown(cooldownSecs()) }}</strong></span>
          </div>
        }

        <!-- ── Stage 1: Pre-auth secret key ── -->
        @if (stage() === 'preauth') {
          <div class="login-form">
            <div class="field-group">
              <label class="field-label">Access Secret Key</label>
              <p class="field-hint">Enter the 16-character portal access key</p>
              <div class="field-wrap">
                <span class="field-icon">🔑</span>
                <input
                  [type]="showKey() ? 'text' : 'password'"
                  class="field-input mono"
                  placeholder="••••••••••••••••"
                  [(ngModel)]="secretKey"
                  [disabled]="loading() || cooldownSecs() > 0"
                  (keydown.enter)="doPreAuth()"
                  autocomplete="off"
                  maxlength="32"
                />
                <button class="show-pass-btn" type="button" (click)="showKey.update(v => !v)" tabindex="-1">
                  {{ showKey() ? '◎' : '◉' }}
                </button>
              </div>
            </div>
            <!-- FIX: Button disabled during cooldown -->
            <button class="login-btn" (click)="doPreAuth()" [disabled]="loading() || !secretKey || cooldownSecs() > 0">
              @if (loading()) { <span class="spinner"></span> Verifying… }
              @else if (cooldownSecs() > 0) { ⏳ Wait {{ formatCooldown(cooldownSecs()) }} }
              @else { Verify Key → }
            </button>
          </div>
        }

        <!-- ── Stage 2: Username + Password ── -->
        @if (stage() === 'login') {
          <div class="login-form">
            <div class="field-group">
              <label class="field-label">Username</label>
              <div class="field-wrap">
                <span class="field-icon">◉</span>
                <input type="text" class="field-input" placeholder="admin"
                  [(ngModel)]="username" [disabled]="loading()"
                  (keydown.enter)="doLogin()" autocomplete="username" />
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Password</label>
              <div class="field-wrap">
                <span class="field-icon">◈</span>
                <input [type]="showPass() ? 'text' : 'password'" class="field-input" placeholder="••••••••"
                  [(ngModel)]="password" [disabled]="loading()"
                  (keydown.enter)="doLogin()" autocomplete="current-password" />
                <button class="show-pass-btn" type="button" (click)="showPass.update(v => !v)" tabindex="-1">
                  {{ showPass() ? '◎' : '◉' }}
                </button>
              </div>
            </div>
            <button class="login-btn" (click)="doLogin()" [disabled]="loading() || !username || !password">
              @if (loading()) { <span class="spinner"></span> Authenticating… }
              @else { Sign In → }
            </button>
            <button class="back-btn" type="button" (click)="stage.set('preauth')">← Back</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0d0d0f; font-family: 'Inter', sans-serif; }
    .login-bg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
    .grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 40px 40px; }
    .gradient-orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.25; }
    .orb-1 { width: 500px; height: 500px; background: radial-gradient(circle, #88ad35, transparent); top: -200px; right: -100px; }
    .orb-2 { width: 400px; height: 400px; background: radial-gradient(circle, #3d8ef0, transparent); bottom: -150px; left: -100px; }
    .login-card { position: relative; z-index: 10; background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 36px; width: 420px; max-width: 95vw; }
    .login-header { text-align: center; margin-bottom: 24px; }
    .login-brand { width: 52px; height: 52px; background: rgba(136,173,53,0.12); border: 1px solid rgba(136,173,53,0.25); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
    .brand-icon { font-size: 24px; }
    .login-header h1 { font-size: 20px; font-weight: 700; color: #f0f0f0; margin-bottom: 5px; }
    .login-header p { font-size: 13px; color: #666; }
    .stage-indicator { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
    .stage-step { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #555; flex: 1; }
    .stage-step.active { color: #88ad35; }
    .stage-step.done { color: #3dcf8e; }
    .step-num { width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .stage-step.active .step-num { background: rgba(136,173,53,0.15); border-color: #88ad35; color: #88ad35; }
    .stage-step.done .step-num { background: rgba(61,207,142,0.12); border-color: #3dcf8e; color: #3dcf8e; }
    .stage-divider { flex: 0; height: 1px; width: 28px; background: rgba(255,255,255,0.08); }
    .login-alert { display: flex; align-items: center; gap: 9px; background: rgba(224,84,84,0.1); border: 1px solid rgba(224,84,84,0.2); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #e05454; margin-bottom: 16px; }
    .login-success { display: flex; align-items: center; gap: 9px; background: rgba(61,207,142,0.08); border: 1px solid rgba(61,207,142,0.2); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #3dcf8e; margin-bottom: 16px; }
    .login-cooldown { display: flex; align-items: center; gap: 9px; background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #ffaa44; margin-bottom: 16px; }
    .login-form { display: flex; flex-direction: column; gap: 16px; }
    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 12.5px; font-weight: 600; color: #888; letter-spacing: 0.3px; }
    .field-hint { font-size: 11.5px; color: #555; }
    .field-wrap { position: relative; display: flex; align-items: center; }
    .field-icon { position: absolute; left: 13px; font-size: 14px; color: #555; pointer-events: none; }
    .field-input { width: 100%; background: #1c1c20; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 11px 42px 11px 38px; font-size: 14px; color: #f0f0f0; font-family: inherit; outline: none; transition: border-color 0.15s; }
    .field-input.mono { font-family: 'Courier New', monospace; letter-spacing: 0.1em; }
    .field-input:focus { border-color: rgba(136,173,53,0.5); }
    .field-input:disabled { opacity: 0.5; }
    .show-pass-btn { position: absolute; right: 12px; background: none; border: none; color: #555; cursor: pointer; font-size: 14px; padding: 4px; }
    .login-btn { background: #88ad35; color: #fff; border: none; border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s; }
    .login-btn:hover:not(:disabled) { background: #698927; }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .back-btn { background: none; border: none; color: #666; font-size: 13px; cursor: pointer; text-align: center; padding: 4px; font-family: inherit; }
    .back-btn:hover { color: #aaa; }
    .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminLoginComponent implements OnDestroy {
  stage = signal<Stage>('preauth');
  loading = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  showKey = signal(false);
  showPass = signal(false);
  // FIX: Reactive signal for live countdown display (in seconds)
  cooldownSecs = signal(0);

  secretKey = '';
  username = '';
  password = '';

  // FIX: Interval handle for live countdown ticker
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private authSvc: AdminAuthService, private router: Router) {
    // FIX: On component init, check if we're already in a lockout (e.g. after page refresh)
    this.updateCooldown();
  }

  ngOnDestroy() {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  /** Reads remaining lockout from service and starts a 1-second countdown ticker. */
  private updateCooldown() {
    const remaining = this.authSvc.getLockoutRemaining();
    if (remaining > 0) {
      this.cooldownSecs.set(Math.ceil(remaining / 1000));
      if (this.cooldownInterval) clearInterval(this.cooldownInterval);
      this.cooldownInterval = setInterval(() => {
        const r = this.authSvc.getLockoutRemaining();
        const secs = Math.ceil(r / 1000);
        this.cooldownSecs.set(secs);
        if (secs <= 0) {
          clearInterval(this.cooldownInterval!);
          this.cooldownInterval = null;
          this.errorMsg.set('');
        }
      }, 1000);
    } else {
      this.cooldownSecs.set(0);
    }
  }

  /** Formats seconds into mm:ss string. */
  formatCooldown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  doPreAuth() {
    if (!this.secretKey || this.loading() || this.cooldownSecs() > 0) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.authSvc.verifyPreAuthKey(this.secretKey).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMsg.set('Access key verified. Enter your credentials.');
        this.stage.set('login');
      },
      error: (err) => {
        this.loading.set(false);
        const status = err?.status;
        if (status === 403) {
          this.errorMsg.set('Your IP is not whitelisted for admin access.');
        } else if (status === 429) {
          // FIX: Start live countdown — service already wrote lockout to localStorage
          this.updateCooldown();
          const secs = err?.error?.retryAfterSeconds ?? this.cooldownSecs();
          this.errorMsg.set(`Too many attempts. Please wait ${this.formatCooldown(secs)}.`);
        } else {
          this.errorMsg.set('Invalid access key. Please check and try again.');
        }
      }
    });
  }

  doLogin() {
    if (!this.username || !this.password || this.loading()) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    this.authSvc.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401) this.errorMsg.set('Invalid username or password.');
        else if (err?.status === 403) this.errorMsg.set('Access denied. IP not authorized.');
        else this.errorMsg.set('Login failed. Please try again.');
      }
    });
  }
}