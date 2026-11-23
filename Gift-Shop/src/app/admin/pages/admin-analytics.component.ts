import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService, AdminAnalyticsData } from '../services/admin-api.services';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="analytics-container">
      <div class="header">
        <h1>Analytics Overview</h1>
        <p class="subtitle">Insights and performance metrics for your store.</p>
      </div>

      <div class="metrics-grid" *ngIf="data()">
        <div class="metric-card">
          <div class="metric-title">Total Orders</div>
          <div class="metric-value">{{ data()?.totalOrders }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Revenue</div>
          <div class="metric-value">₹{{ data()?.totalRevenue?.toLocaleString('en-IN') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Revenue (Last 30 Days)</div>
          <div class="metric-value">₹{{ data()?.revenueLast30Days?.toLocaleString('en-IN') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Customers</div>
          <div class="metric-value">{{ data()?.totalCustomers }}</div>
        </div>
      </div>

      <div class="content-grid" *ngIf="data()">
        <div class="chart-section">
          <h3>Sales (Last 30 Days)</h3>
          <div class="chart-container" *ngIf="data()?.dailySales?.length; else noData">
            <div class="chart-bars">
              <div class="bar-group" *ngFor="let day of data()!.dailySales" [title]="day.date + ': ₹' + day.sales">
                <div class="bar" [style.height.%]="getBarHeight(day.sales)"></div>
                <div class="bar-label">{{ day.date | date:'dd MMM' }}</div>
              </div>
            </div>
          </div>
          <ng-template #noData>
            <p class="empty">No sales data available for the last 30 days.</p>
          </ng-template>
        </div>

        <div class="top-products-section">
          <h3>Top 5 Selling Products</h3>
          <ul class="product-list" *ngIf="data()?.topProducts?.length; else noProducts">
            <li class="product-item" *ngFor="let prod of data()!.topProducts">
              <div class="prod-info">
                <span class="prod-title">{{ prod.title || 'Unknown Product' }}</span>
                <span class="prod-qty">{{ prod.totalQuantitySold }} sold</span>
              </div>
              <div class="prod-revenue">₹{{ prod.totalRevenue.toLocaleString('en-IN') }}</div>
            </li>
          </ul>
          <ng-template #noProducts>
            <p class="empty">No product sales yet.</p>
          </ng-template>
        </div>
      </div>

      <div class="loading-state" *ngIf="isLoading()">
        <div class="spinner"></div>
        <p>Loading analytics data...</p>
      </div>
      
      <p class="error" *ngIf="error()">{{ error() }}</p>
    </div>
  `,
  styles: [`
    .analytics-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 2rem; }
    .header h1 { font-family: var(--font-display); font-size: 2rem; color: var(--color-charcoal); }
    .subtitle { color: var(--color-body); font-size: 1rem; }
    
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .metric-card { background: #fff; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
    .metric-title { font-size: 0.85rem; color: var(--color-body); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
    .metric-value { font-size: 2rem; font-weight: 700; color: var(--color-primary); font-family: var(--font-display); }

    .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
    
    .chart-section, .top-products-section { background: #fff; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--color-border); }
    h3 { font-family: var(--font-display); font-size: 1.2rem; color: var(--color-charcoal); margin-bottom: 1.5rem; }
    
    .chart-container { height: 300px; display: flex; align-items: flex-end; padding-top: 1rem; border-bottom: 1px solid var(--color-border); overflow-x: auto; padding-bottom: 0.5rem; }
    .chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 100%; min-width: max-content; }
    .bar-group { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 40px; cursor: pointer; }
    .bar { width: 100%; background: var(--color-primary); border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.5s ease; opacity: 0.8; }
    .bar:hover { opacity: 1; }
    .bar-label { font-size: 0.7rem; color: var(--color-body); margin-top: 0.5rem; transform: rotate(-45deg); transform-origin: top left; white-space: nowrap; margin-bottom: 2rem;}

    .product-list { list-style: none; padding: 0; margin: 0; }
    .product-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
    .product-item:last-child { border-bottom: none; }
    .prod-info { display: flex; flex-direction: column; }
    .prod-title { font-weight: 600; font-size: 0.95rem; color: var(--color-charcoal); }
    .prod-qty { font-size: 0.8rem; color: var(--color-body); margin-top: 0.2rem; }
    .prod-revenue { font-weight: 700; color: var(--color-primary); }
    
    .empty { color: var(--color-body); font-style: italic; }
    .error { color: #ef4444; margin-top: 1rem; }
    .loading-state { text-align: center; padding: 3rem; color: var(--color-body); }
    .spinner { border: 3px solid rgba(136,173,53,0.2); border-top-color: var(--color-primary); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminAnalyticsComponent implements OnInit {
  private api = inject(AdminApiService);
  
  data = signal<AdminAnalyticsData | null>(null);
  isLoading = signal(false);
  error = signal('');
  maxSales = signal(0);

  ngOnInit() {
    this.fetchData();
  }

  fetchData() {
    this.isLoading.set(true);
    this.error.set('');
    
    this.api.getAnalytics().subscribe({
      next: (res) => {
        this.data.set(res);
        if (res.dailySales && res.dailySales.length > 0) {
          this.maxSales.set(Math.max(...res.dailySales.map(d => d.sales)));
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Failed to load analytics data.');
        this.isLoading.set(false);
      }
    });
  }

  getBarHeight(sales: number): number {
    const max = this.maxSales();
    if (max === 0) return 0;
    return (sales / max) * 100;
  }
}
