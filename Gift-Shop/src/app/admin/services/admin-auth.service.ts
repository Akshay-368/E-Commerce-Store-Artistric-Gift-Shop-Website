import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const API = 'http://localhost:5000';

// Storage keys
const LOCK_KEY      = '__adm_lock';       // pre-auth cooldown expiry (ms)
const TOTP_LOCK_KEY = '__adm_totp_lock';  // TOTP cooldown expiry (ms)

export interface AdminSession {
  token: string;
  expiresAt: number;
  adminUser: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly SESSION_KEY  = '__adm_sess';
  private readonly PREAUTH_KEY  = '__adm_pak';
  private platformId = inject(PLATFORM_ID);
  private isBrowser  = isPlatformBrowser(this.platformId);
  private http       = inject(HttpClient);

  isAuthenticated = signal(false);
  private preAuthKey = '';

  constructor() { this.restoreSession(); }

  private restoreSession() {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return;
      const sess: AdminSession = JSON.parse(raw);
      if (sess.expiresAt > Date.now()) {
        this.isAuthenticated.set(true);
        this.preAuthKey = sessionStorage.getItem(this.PREAUTH_KEY) ?? '';
      } else {
        sessionStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.PREAUTH_KEY);
      }
    } catch {
      sessionStorage.removeItem(this.SESSION_KEY);
      sessionStorage.removeItem(this.PREAUTH_KEY);
    }
  }

  getToken(): string {
    if (!this.isBrowser) return '';
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return '';
      const sess: AdminSession = JSON.parse(raw);
      return sess.expiresAt > Date.now() ? sess.token : '';
    } catch { return ''; }
  }

  getPreAuthKey(): string { return this.preAuthKey; }

  // ── Stage 1: Pre-auth key ────────────────────────────────────────────
  verifyPreAuthKey(key: string): Observable<any> {
    const headers = new HttpHeaders({ 'X-Admin-PreAuth-Key': key });
    return this.http.post<any>(`${API}/api/admin/preauth`, {}, { headers }).pipe(
      tap(() => {
        this.preAuthKey = key;
        if (this.isBrowser) {
          sessionStorage.setItem(this.PREAUTH_KEY, key);
          localStorage.removeItem(LOCK_KEY);
        }
      }),
      catchError(err => {
        if (err?.status === 429 && this.isBrowser) {
          const secs: number = err?.error?.retryAfterSeconds ?? 180;
          localStorage.setItem(LOCK_KEY, String(Date.now() + secs * 1000));
        }
        return throwError(() => err);
      })
    );
  }

  // ── Stage 2: TOTP verification ───────────────────────────────────────
  verifyTotp(code: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type':        'application/json',
      'X-Admin-PreAuth-Key': this.preAuthKey,
    });
    return this.http.post<any>(`${API}/api/admin/verify-totp`, { code }, { headers }).pipe(
      tap(() => {
        if (this.isBrowser) localStorage.removeItem(TOTP_LOCK_KEY);
      }),
      catchError(err => {
        if (err?.status === 429 && this.isBrowser) {
          const secs: number = err?.error?.retryAfterSeconds ?? 60;
          localStorage.setItem(TOTP_LOCK_KEY, String(Date.now() + secs * 1000));
        }
        return throwError(() => err);
      })
    );
  }

  // ── Stage 3: Username + password ─────────────────────────────────────
  login(username: string, password: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type':        'application/json',
      'X-Admin-PreAuth-Key': this.preAuthKey,
    });
    return this.http.post<any>(`${API}/api/admin/login`, { userName: username, password }, { headers }).pipe(
      tap(res => {
        const sess: AdminSession = {
          token:     res.token,
          expiresAt: new Date(res.expiresAt).getTime(),
          adminUser: res.displayName ?? username,
        };
        if (this.isBrowser) {
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sess));
          localStorage.removeItem(LOCK_KEY);
          localStorage.removeItem(TOTP_LOCK_KEY);
        }
        this.isAuthenticated.set(true);
      }),
      catchError(err => throwError(() => err))
    );
  }

  logout() {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.PREAUTH_KEY);
    this.preAuthKey = '';
    this.isAuthenticated.set(false);
  }

  /** Returns remaining pre-auth cooldown in milliseconds (0 if not locked). */
  getLockoutRemaining(): number {
    return this._getRemainingMs(LOCK_KEY);
  }

  /** Returns remaining TOTP cooldown in milliseconds (0 if not locked). */
  getTotpLockoutRemaining(): number {
    return this._getRemainingMs(TOTP_LOCK_KEY);
  }

  private _getRemainingMs(key: string): number {
    if (!this.isBrowser) return 0;
    const lockUntil = Number(localStorage.getItem(key) ?? 0);
    const remaining = Math.max(0, lockUntil - Date.now());
    if (remaining === 0 && lockUntil > 0) localStorage.removeItem(key);
    return remaining;
  }
}