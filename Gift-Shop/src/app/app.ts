import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CartDrawerComponent } from './components/cart-drawer.component';
import { NavbarComponent } from './components/navbar.component';
import { ProductDetailDrawerComponent } from './components/product-detail-drawer.component';
import { TrackOrderModalComponent } from './components/track-order-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ProductDetailDrawerComponent, CartDrawerComponent, TrackOrderModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('Gift-Shop');
}
