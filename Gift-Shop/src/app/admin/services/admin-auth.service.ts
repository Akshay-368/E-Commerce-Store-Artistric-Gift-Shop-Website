import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export interface AdminSession {
  token: string;
  expiresAt: number;
  adminUser: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly SESSION_KEY = '__adm_sess';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 min
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  isAuthenticated = signal(false);

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return;
      const sess: AdminSession = JSON.parse(raw);
      if (sess.expiresAt > Date.now()) {
        this.isAuthenticated.set(true);
      } else {
        sessionStorage.removeItem(this.SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  /** Returns true on success, 'locked' if locked out, false on bad creds */
  login(username: string, password: string): boolean | 'locked' {
    if (!this.isBrowser) return false;
    const lockKey = '__adm_lock';
    const attKey = '__adm_att';

    const lockUntil = Number(localStorage.getItem(lockKey) ?? 0);
    if (lockUntil > Date.now()) return 'locked';

    // --- Placeholder credential check; replace with real API call ---
    const valid = username === 'admin' && password === 'admin@2026';

    if (!valid) {
      const attempts = Number(localStorage.getItem(attKey) ?? 0) + 1;
      localStorage.setItem(attKey, String(attempts));
      if (attempts >= this.MAX_ATTEMPTS) {
        localStorage.setItem(lockKey, String(Date.now() + this.LOCKOUT_MS));
        localStorage.removeItem(attKey);
      }
      return false;
    }

    localStorage.removeItem(attKey);
    localStorage.removeItem(lockKey);

    const sess: AdminSession = {
      token: 'mock-jwt-' + Math.random().toString(36).slice(2),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      adminUser: username,
    };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sess));
    this.isAuthenticated.set(true);
    return true;
  }

  logout() {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(this.SESSION_KEY);
    this.isAuthenticated.set(false);
  }

  getLockoutRemaining(): number {
    if (!this.isBrowser) return 0;
    const lockUntil = Number(localStorage.getItem('__adm_lock') ?? 0);
    return Math.max(0, lockUntil - Date.now());
  }
}
