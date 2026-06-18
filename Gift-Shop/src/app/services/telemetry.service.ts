import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  trackUserAction(action: string, metadata: string): void {
    const payload = JSON.stringify({ action, metadata });
    const url = 'http://localhost:5000/api/monitoring/ping'; // or relative when using proxy

    // Use native fetch with keepalive
    if (typeof fetch !== 'undefined') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {
        // Silent fail – monitoring must never break the UI
      });
    }
  }
}