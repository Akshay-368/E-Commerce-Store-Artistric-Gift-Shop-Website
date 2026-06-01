import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: string;
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell" [class.sidebar-collapsed]="sidebarCollapsed()">

      <!-- Sidebar -->
      <aside class="admin-sidebar">
        <div class="sidebar-header">
          <div class="brand-mark">
            <span class="brand-icon">⬡</span>
            <span class="brand-text">Kalakaari</span>
            <span class="brand-sub">Admin</span>
          </div>
          <button class="collapse-btn" (click)="toggleSidebar()" title="Toggle sidebar">
            <span>{{ sidebarCollapsed() ? '›' : '‹' }}</span>
          </button>
        </div>

        <nav class="sidebar-nav">
          @for (section of navSections; track section.title) {
            <div class="nav-section">
              <span class="nav-section-label">{{ section.title }}</span>
              @for (item of section.items; track item.route) {
                <a
                  [routerLink]="item.route"
                  routerLinkActive="active"
                  class="nav-item"
                  [title]="item.label"
                >
                  <span class="nav-icon">{{ item.icon }}</span>
                  <span class="nav-label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="nav-badge">{{ item.badge }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="admin-user-chip">
            <span class="user-avatar">A</span>
            <span class="user-info">
              <span class="user-name">Admin</span>
              <span class="user-role">Super Admin</span>
            </span>
          </div>
          <button class="logout-btn" (click)="logout()">
            <span>⎋</span>
          </button>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="admin-main">

        <!-- Top Bar -->
        <header class="admin-topbar">
          <div class="topbar-left">
            <div class="breadcrumb-area">
              <span class="page-title">{{ currentPageTitle() }}</span>
            </div>
          </div>
          <div class="topbar-right">
            <div class="topbar-search">
              <span class="search-icon">⌕</span>
              <input type="text" placeholder="Search orders, products…" class="search-input" />
              <span class="search-kbd">⌘K</span>
            </div>
            <button class="topbar-btn" title="Draft">
              <span>◎</span>
              <span class="btn-text">Draft</span>
            </button>
            <button class="topbar-btn primary" title="Publish">
              <span>↑</span>
              <span class="btn-text">Publish</span>
            </button>
          </div>
        </header>

        <!-- Page Content -->
        <main class="admin-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --adm-bg: #0d0d0e;
      --adm-surface: #141416;
      --adm-surface-2: #1c1c20;
      --adm-surface-3: #242428;
      --adm-border: rgba(255,255,255,0.07);
      --adm-border-bright: rgba(255,255,255,0.14);
      --adm-text: #f0f0f0;
      --adm-text-muted: #888;
      --adm-text-faint: #555;
      --adm-accent: #88ad35;
      --adm-accent-d: #698927;
      --adm-accent-glow: rgba(136,173,53,0.15);
      --adm-danger: #e05454;
      --adm-warn: #e0a832;
      --adm-info: #3d8ef0;
      --adm-success: #3dcf8e;
      --adm-sidebar-w: 240px;
      --adm-sidebar-w-col: 64px;
      --adm-topbar-h: 56px;
      --adm-radius: 10px;
      --adm-font: 'Inter', 'DM Sans', system-ui, sans-serif;
      --adm-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
      display: block;
      font-family: var(--adm-font);
    }

    .admin-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--adm-bg);
      color: var(--adm-text);
    }

    /* ─── SIDEBAR ─── */
    .admin-sidebar {
      width: var(--adm-sidebar-w);
      min-width: var(--adm-sidebar-w);
      background: var(--adm-surface);
      border-right: 1px solid var(--adm-border);
      display: flex;
      flex-direction: column;
      transition: width 0.25s ease, min-width 0.25s ease;
      overflow: hidden;
      z-index: 100;
    }

    .sidebar-collapsed .admin-sidebar {
      width: var(--adm-sidebar-w-col);
      min-width: var(--adm-sidebar-w-col);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 16px 14px;
      border-bottom: 1px solid var(--adm-border);
      min-height: 64px;
    }

    .brand-mark {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
      white-space: nowrap;
    }

    .brand-icon {
      font-size: 20px;
      color: var(--adm-accent);
      flex-shrink: 0;
      line-height: 1;
    }

    .brand-text {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: var(--adm-text);
    }

    .brand-sub {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--adm-accent);
      background: var(--adm-accent-glow);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .sidebar-collapsed .brand-text,
    .sidebar-collapsed .brand-sub {
      display: none;
    }

    .collapse-btn {
      background: none;
      border: 1px solid var(--adm-border);
      color: var(--adm-text-muted);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .collapse-btn:hover {
      border-color: var(--adm-border-bright);
      color: var(--adm-text);
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 12px 8px;
      scrollbar-width: none;
    }

    .sidebar-nav::-webkit-scrollbar { display: none; }

    .nav-section {
      margin-bottom: 4px;
    }

    .nav-section-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--adm-text-faint);
      padding: 10px 10px 4px;
      white-space: nowrap;
      overflow: hidden;
    }

    .sidebar-collapsed .nav-section-label {
      opacity: 0;
      padding: 8px 0 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      color: var(--adm-text-muted);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.15s;
      position: relative;
      cursor: pointer;
    }

    .nav-item:hover {
      background: var(--adm-surface-2);
      color: var(--adm-text);
    }

    .nav-item.active {
      background: var(--adm-accent-glow);
      color: var(--adm-accent);
    }

    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 20px;
      background: var(--adm-accent);
      border-radius: 0 3px 3px 0;
    }

    .nav-icon {
      font-size: 16px;
      flex-shrink: 0;
      width: 20px;
      text-align: center;
    }

    .nav-label {
      flex: 1;
      overflow: hidden;
    }

    .sidebar-collapsed .nav-label,
    .sidebar-collapsed .nav-badge {
      display: none;
    }

    .nav-badge {
      background: var(--adm-danger);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid var(--adm-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .admin-user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      overflow: hidden;
      padding: 6px 8px;
      border-radius: 8px;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--adm-accent);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--adm-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 11px;
      color: var(--adm-text-faint);
      white-space: nowrap;
    }

    .sidebar-collapsed .user-info { display: none; }

    .logout-btn {
      background: none;
      border: 1px solid var(--adm-border);
      color: var(--adm-text-muted);
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .logout-btn:hover {
      border-color: var(--adm-danger);
      color: var(--adm-danger);
    }

    /* ─── MAIN ─── */
    .admin-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    .admin-topbar {
      height: var(--adm-topbar-h);
      min-height: var(--adm-topbar-h);
      background: var(--adm-surface);
      border-bottom: 1px solid var(--adm-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      gap: 16px;
      z-index: 50;
    }

    .topbar-left { display: flex; align-items: center; gap: 12px; }

    .page-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--adm-text);
      letter-spacing: -0.2px;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .topbar-search {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--adm-surface-2);
      border: 1px solid var(--adm-border);
      border-radius: 8px;
      padding: 6px 12px;
      min-width: 220px;
      transition: border-color 0.15s;
    }

    .topbar-search:focus-within {
      border-color: var(--adm-accent);
    }

    .search-icon {
      color: var(--adm-text-muted);
      font-size: 15px;
    }

    .search-input {
      background: none;
      border: none;
      outline: none;
      color: var(--adm-text);
      font-size: 13px;
      font-family: var(--adm-font);
      flex: 1;
    }

    .search-input::placeholder { color: var(--adm-text-faint); }

    .search-kbd {
      font-size: 11px;
      color: var(--adm-text-faint);
      background: var(--adm-surface-3);
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid var(--adm-border);
    }

    .topbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      background: var(--adm-surface-2);
      border: 1px solid var(--adm-border);
      color: var(--adm-text-muted);
      font-size: 13px;
      font-family: var(--adm-font);
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .topbar-btn:hover {
      border-color: var(--adm-border-bright);
      color: var(--adm-text);
    }

    .topbar-btn.primary {
      background: var(--adm-accent);
      border-color: var(--adm-accent);
      color: #fff;
    }

    .topbar-btn.primary:hover {
      background: var(--adm-accent-d);
      border-color: var(--adm-accent-d);
    }

    .admin-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px;
      background: var(--adm-bg);
      scrollbar-width: thin;
      scrollbar-color: var(--adm-surface-3) transparent;
    }

    .admin-content::-webkit-scrollbar { width: 6px; }
    .admin-content::-webkit-scrollbar-thumb {
      background: var(--adm-surface-3);
      border-radius: 3px;
    }
  `]
})
export class AdminShellComponent {
  sidebarCollapsed = signal(false);

  navSections = [
    {
      title: 'Overview',
      items: [
        { icon: '◈', label: 'Dashboard', route: '/admin/dashboard' },
        { icon: '◉', label: 'Analytics', route: '/admin/analytics' },
      ]
    },
    {
      title: 'Catalog',
      items: [
        { icon: '⊞', label: 'Products', route: '/admin/products' },
        { icon: '⊟', label: 'Categories', route: '/admin/categories' },
        { icon: '⊟', label: 'Media Library', route: '/admin/media' },
      ]
    },
    {
      title: 'Content',
      items: [
        { icon: '⊡', label: 'Homepage', route: '/admin/homepage' },
        { icon: '◱', label: 'Reviews', route: '/admin/reviews' },
      ]
    },
    {
      title: 'Commerce',
      items: [
        { icon: '◳', label: 'Orders', route: '/admin/orders', badge: '3' },
        { icon: '◲', label: 'Payments', route: '/admin/payments' },
        { icon: '◰', label: 'Invoices', route: '/admin/invoices' },
        { icon: '◧', label: 'Tracking', route: '/admin/tracking' },
      ]
    },
    {
      title: 'System',
      items: [
        { icon: '◈', label: 'Automation', route: '/admin/automation' },
        { icon: '◫', label: 'Settings', route: '/admin/settings' },
        { icon: '◬', label: 'Security', route: '/admin/security' },
      ]
    }
  ];

  currentPageTitle = computed(() => 'Admin Portal');

  constructor(private auth: AdminAuthService, private router: Router) {}

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
