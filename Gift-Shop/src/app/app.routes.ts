import { Routes } from '@angular/router';
import { AdminLoginComponent } from './admin/components/admin-login.component';
import { AdminShellComponent } from './admin/components/admin-shell.component';
import { adminAuthGuard } from './admin/guards/admin.auth.guard';
import { AdminAnalyticsComponent } from './admin/pages/admin-analytics.component';
import { AdminAutomationComponent } from './admin/pages/admin-automation.component';
import { AdminCategoriesComponent } from './admin/pages/admin-categories.component';
import { AdminDashboardComponent } from './admin/pages/admin-dashboard.component';
import { AdminHomepageComponent } from './admin/pages/admin-homepage.component';
import { AdminInvoicesComponent } from './admin/pages/admin-invoices.component';
import { AdminMediaComponent } from './admin/pages/admin-media.component';
//import { AdminOrdersComponent } from './admin/pages/admin-orders.component';
import { AdminOrdersComponent } from './admin/components/admin-orders.component';
import { AdminPaymentsComponent } from './admin/pages/admin-payments.component';
import { AdminProductsComponent } from './admin/pages/admin-products.component';
import { AdminReviewsComponent } from './admin/pages/admin-reviews.component';
import { AdminSecurityComponent } from './admin/pages/admin-security.component';
import { AdminSettingsComponent } from './admin/pages/admin-settings.component';
import { AdminTrackingComponent } from './admin/pages/admin-tracking.component';
import { HomeComponent } from './components/home.component';

export const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'admin/login', component: AdminLoginComponent },
	{
		path: 'admin',
		component: AdminShellComponent,
		canActivate: [adminAuthGuard],
		children: [
			{ path: 'dashboard', component: AdminDashboardComponent },
			{ path: 'analytics', component: AdminAnalyticsComponent },
			{ path: 'products', component: AdminProductsComponent },
			{ path: 'categories', component: AdminCategoriesComponent },
			{ path: 'media', component: AdminMediaComponent },
			{ path: 'homepage', component: AdminHomepageComponent },
			{ path: 'reviews', component: AdminReviewsComponent },
			{ path: 'orders', component: AdminOrdersComponent },
			{ path: 'payments', component: AdminPaymentsComponent },
			{ path: 'invoices', component: AdminInvoicesComponent },
			{ path: 'tracking', component: AdminTrackingComponent },
			{ path: 'automation', component: AdminAutomationComponent },
			{ path: 'settings', component: AdminSettingsComponent },
			{ path: 'security', component: AdminSecurityComponent },
			{ path: '', redirectTo: 'dashboard', pathMatch: 'full' },
		]
	},
];
