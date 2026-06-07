import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const API = 'http://localhost:5000';

// FIX: Storage key for lockout expiry timestamp (ms since epoch)
const LOCK_KEY = '__adm_lock';

export interface AdminSession {
  token: string;
  expiresAt: number;
  adminUser: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly SESSION_KEY = '__adm_sess';
  private readonly PREAUTH_KEY = '__adm_pak';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private http = inject(HttpClient);

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
        // Restore preAuthKey from sessionStorage so it survives page refresh
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

  /**
   * Step 1 – validate the 16-char secret key.
   * Hits POST /api/admin/preauth with X-Admin-PreAuth-Key header.
   */
  verifyPreAuthKey(key: string): Observable<any> {
    const headers = new HttpHeaders({ 'X-Admin-PreAuth-Key': key });
    return this.http.post<any>(`${API}/api/admin/preauth`, {}, { headers }).pipe(
      tap(() => {
        this.preAuthKey = key;
        if (this.isBrowser) {
          sessionStorage.setItem(this.PREAUTH_KEY, key);
          // FIX: Clear any existing lockout on successful pre-auth
          localStorage.removeItem(LOCK_KEY);
        }
      }),
      catchError(err => {
        // FIX: When backend returns 429 (cooldown), read the retry-after from the
        // response body (seconds) and write the lockout expiry to localStorage
        // so getLockoutRemaining() can return meaningful values to the UI.
        if (err?.status === 429 && this.isBrowser) {
          const secondsRemaining: number = err?.error?.retryAfterSeconds ?? 180; // default 3 min
          const lockUntil = Date.now() + secondsRemaining * 1000;
          localStorage.setItem(LOCK_KEY, String(lockUntil));
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Step 2 – login with username + password.
   * Requires pre-auth key to be set first.
   */
  login(username: string, password: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Admin-PreAuth-Key': this.preAuthKey,
    });
    return this.http.post<any>(`${API}/api/admin/login`, { userName: username, password }, { headers }).pipe(
      tap(res => {
        const sess: AdminSession = {
          token: res.token,
          expiresAt: new Date(res.expiresAt).getTime(),
          adminUser: res.displayName ?? username,
        };
        if (this.isBrowser) {
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sess));
          localStorage.removeItem(LOCK_KEY);
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

  /**
   * Returns remaining lockout milliseconds (0 if not locked out).
   * FIX: Now actually reads from localStorage which is populated by verifyPreAuthKey()
   * when the backend returns a 429 response.
   */
  getLockoutRemaining(): number {
    if (!this.isBrowser) return 0;
    const lockUntil = Number(localStorage.getItem(LOCK_KEY) ?? 0);
    const remaining = Math.max(0, lockUntil - Date.now());
    // Clean up expired lockout entry
    if (remaining === 0 && lockUntil > 0) localStorage.removeItem(LOCK_KEY);
    return remaining;
  }
}