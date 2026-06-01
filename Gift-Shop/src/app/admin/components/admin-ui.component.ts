import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/* ── Stat Card ─────────────────────────────────────────────── */
@Component({
  selector: 'adm-stat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card" [class]="'trend-' + trend">
      <div class="stat-header">
        <span class="stat-icon">{{ icon }}</span>
        <span class="stat-trend" *ngIf="delta">{{ delta }}</span>
      </div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: #141416;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color 0.15s;
    }
    .stat-card:hover { border-color: rgba(255,255,255,0.14); }
    .stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .stat-icon { font-size: 18px; opacity: 0.9; }
    .stat-trend { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 20px; }
    .trend-up .stat-trend { background: rgba(61,207,142,0.12); color: #3dcf8e; }
    .trend-down .stat-trend { background: rgba(224,84,84,0.12); color: #e05454; }
    .trend-neutral .stat-trend { background: rgba(255,255,255,0.06); color: #888; }
    .stat-value { font-size: 26px; font-weight: 700; color: #f0f0f0; letter-spacing: -1px; line-height: 1.1; }
    .stat-label { font-size: 12.5px; color: #666; font-weight: 500; }
  `]
})
export class AdminStatComponent {
  @Input() icon = '◈';
  @Input() value = '0';
  @Input() label = '';
  @Input() delta = '';
  @Input() trend: 'up' | 'down' | 'neutral' = 'neutral';
}

/* ── Section Header ─────────────────────────────────────────── */
@Component({
  selector: 'adm-section',
  standalone: true,
  template: `
    <div class="adm-section-header">
      <div>
        <h2 class="section-title">{{ title }}</h2>
        <p class="section-sub" *ngIf="sub">{{ sub }}</p>
      </div>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .adm-section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .section-title { font-size: 17px; font-weight: 700; color: #f0f0f0; letter-spacing: -0.3px; }
    .section-sub { font-size: 13px; color: #666; margin-top: 3px; }
  `],
  imports: [CommonModule]
})
export class AdminSectionComponent {
  @Input() title = '';
  @Input() sub = '';
}

/* ── Badge ──────────────────────────────────────────────────── */
@Component({
  selector: 'adm-badge',
  standalone: true,
  template: `<span class="adm-badge" [class]="'badge-' + color">{{ label }}</span>`,
  styles: [`
    .adm-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.2px; white-space: nowrap; }
    .badge-green { background: rgba(61,207,142,0.12); color: #3dcf8e; }
    .badge-yellow { background: rgba(224,168,50,0.12); color: #e0a832; }
    .badge-red { background: rgba(224,84,84,0.12); color: #e05454; }
    .badge-blue { background: rgba(61,143,240,0.12); color: #3d8ef0; }
    .badge-gray { background: rgba(255,255,255,0.07); color: #888; }
    .badge-accent { background: rgba(136,173,53,0.12); color: #88ad35; }
  `]
})
export class AdminBadgeComponent {
  @Input() label = '';
  @Input() color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'accent' = 'gray';
}

/* ── WIP Modal ──────────────────────────────────────────────── */
@Component({
  selector: 'adm-wip-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="wip-backdrop" (click)="close.emit()">
        <div class="wip-modal" (click)="$event.stopPropagation()">
          <div class="wip-icon">🚧</div>
          <h3>{{ title || 'Feature Under Development' }}</h3>
          <p>{{ message || 'This feature is currently being built. It will be fully functional once the backend and database are integrated.' }}</p>
          <div class="wip-tag">Planned for backend integration phase</div>
          <button class="wip-close-btn" (click)="close.emit()">Got it</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .wip-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.15s ease;
      backdrop-filter: blur(4px);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .wip-modal {
      background: #1c1c20; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
      padding: 36px; max-width: 380px; width: 90%; text-align: center;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
    .wip-icon { font-size: 36px; margin-bottom: 14px; }
    h3 { font-size: 18px; font-weight: 700; color: #f0f0f0; margin-bottom: 10px; }
    p { font-size: 14px; color: #888; line-height: 1.6; margin-bottom: 16px; }
    .wip-tag { background: rgba(136,173,53,0.1); border: 1px solid rgba(136,173,53,0.2); color: #88ad35; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
    .wip-close-btn {
      background: #88ad35; color: #fff; border: none; border-radius: 10px;
      padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%;
    }
    .wip-close-btn:hover { background: #698927; }
  `]
})
export class AdminWipModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Output() close = new EventEmitter<void>();
}

/* ── Action Button ──────────────────────────────────────────── */
@Component({
  selector: 'adm-btn',
  standalone: true,
  template: `
    <button class="adm-btn" [class]="'btn-' + variant" [disabled]="disabled" (click)="clicked.emit()">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .adm-btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
      font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .adm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-primary { background: #88ad35; border-color: #88ad35; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #698927; border-color: #698927; }
    .btn-secondary { background: #1c1c20; border-color: rgba(255,255,255,0.1); color: #c0c0c0; }
    .btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: #f0f0f0; }
    .btn-danger { background: rgba(224,84,84,0.1); border-color: rgba(224,84,84,0.25); color: #e05454; }
    .btn-danger:hover:not(:disabled) { background: rgba(224,84,84,0.2); }
  `]
})
export class AdminButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'secondary';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
