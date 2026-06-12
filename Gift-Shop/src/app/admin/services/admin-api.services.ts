import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminAuthService } from './admin-auth.service';

const API = 'http://localhost:5000';

/*
export interface AdminProduct {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  price: number;
  categoryId?: string;
  categoryName?: string;
  isActive: boolean;
  sortOrder: number;
  images: AdminProductImage[];
}

export interface AdminProductImage {
  id: string;
  imageUrl: string;
  optimizedUrl: string;
  publicId?: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface CreateProductRequest {
  title: string;
  description: string;
  price: number;
  categoryId?: string;
  shortDescription?: string;
  sortOrder?: number;
}

export interface UpdateProductRequest {
  title: string;
  description: string;
  price: number;
  categoryId?: string;
  shortDescription?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SiteContentSummary {
  id: string;
  contentKey: string;
  sectionName: string;
  kind: string;
  textValue?: string;
  mimeType?: string;
  displayLocation?: string;
  altText?: string;
  sortOrder: number;
  isActive: boolean;
  hasBinary: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
  }

  private handle<T>(obs: Observable<T>): Observable<T> {
    return obs.pipe(catchError(err => {
      console.error('[AdminApi]', err);
      return throwError(() => err);
    }));
  }

  // ── Products ─────────────────────────────────────────────────────────

  getProducts(page = 1, pageSize = 50): Observable<{ total: number; items: AdminProduct[] }> {
    return this.handle(this.http.get<any>(`${API}/api/admin/products?page=${page}&pageSize=${pageSize}`, { headers: this.headers() }));
  }

  createProduct(req: CreateProductRequest): Observable<AdminProduct> {
    return this.handle(this.http.post<AdminProduct>(`${API}/api/admin/products`, req, { headers: this.headers() }));
  }

  updateProduct(id: string, req: UpdateProductRequest): Observable<AdminProduct> {
    return this.handle(this.http.put<AdminProduct>(`${API}/api/admin/products/${id}`, req, { headers: this.headers() }));
  }

  deleteProduct(id: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/products/${id}`, { headers: this.headers() }));
  }

  uploadProductImage(productId: string, file: File, isPrimary = false): Observable<AdminProductImage> {
    const form = new FormData();
    form.append('file', file);
    // Do NOT set Content-Type — browser sets multipart boundary automatically
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`,
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
    return this.handle(this.http.post<AdminProductImage>(
      `${API}/api/admin/products/${productId}/images?isPrimary=${isPrimary}`,
      form, { headers }
    ));
  }

  deleteProductImage(productId: string, imageId: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/products/${productId}/images/${imageId}`, { headers: this.headers() }));
  }

  setPrimaryImage(productId: string, imageId: string): Observable<void> {
    return this.handle(this.http.put<void>(`${API}/api/admin/products/${productId}/images/${imageId}/primary`, {}, { headers: this.headers() }));
  }

  // ── Site Content ─────────────────────────────────────────────────────

  getAllContent(): Observable<SiteContentSummary[]> {
    return this.handle(this.http.get<SiteContentSummary[]>(`${API}/api/admin/content`, { headers: this.headers() }));
  }

  uploadSectionImage(
    file: File, section: string, contentKey: string,
    altText: string, sortOrder: number
  ): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`,
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
    const params = `section=${encodeURIComponent(section)}&contentKey=${encodeURIComponent(contentKey)}&altText=${encodeURIComponent(altText)}&sortOrder=${sortOrder}`;
    return this.handle(this.http.post<any>(`${API}/api/admin/content/image?${params}`, form, { headers }));
  }

  upsertTextContent(contentKey: string, sectionName: string, textValue: string, sortOrder = 0): Observable<void> {
    return this.handle(this.http.put<void>(`${API}/api/admin/content/text`, { contentKey, sectionName, textValue, sortOrder }, { headers: this.headers() }));
  }

  deleteContent(id: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/content/${id}`, { headers: this.headers() }));
  }

  toggleContent(id: string): Observable<{ id: string; isActive: boolean }> {
    return this.handle(this.http.put<any>(`${API}/api/admin/content/${id}/toggle`, {}, { headers: this.headers() }));
  }
}
*/

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  productCount: number;
}

export interface AdminProduct {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  price: number;
  categoryId?: string;
  categoryName?: string;
  isActive: boolean;
  sortOrder: number;
  images: AdminProductImage[];
}

export interface AdminProductImage {
  id: string;
  imageUrl: string;
  optimizedUrl: string;
  publicId?: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface CreateProductRequest {
  title: string;
  description: string;
  price: number;
  categoryId?: string;
  shortDescription?: string;
  sortOrder?: number;
}

export interface UpdateProductRequest {
  title: string;
  description: string;
  price: number;
  categoryId?: string;
  shortDescription?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SiteContentSummary {
  id: string;
  contentKey: string;
  sectionName: string;
  kind: string;
  textValue?: string;
  mimeType?: string;
  displayLocation?: string;
  altText?: string;
  sortOrder: number;
  isActive: boolean;
  hasBinary: boolean;
  /** External/CDN URL for seeded default images (Unsplash , etc.) */
  externalImageUrl?: string | null ;
}

// ── Order types ─────────────────────────────────────────────────────
export interface AdminOrderListItem {
  id: string;
  publicOrderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;       // OrderStatus enum string
  paymentStatus: string; // PaymentStatus enum string
  totalAmount: number;
  createdAt: string;
  itemCount: number;
}

export interface AdminOrderDetail {
  id: string;
  publicOrderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
  deliveredAt?: string;
  items: AdminOrderItem[];
  messages: AdminOrderMessage[];
}

export interface AdminOrderItem {
  id: string;
  productId: string;
  titleSnapshot: string;
  priceSnapshot: number;
  quantity: number;
}

export interface AdminOrderMessage {
  id: string;
  sender: string;
  messageText: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
  }

  private handle<T>(obs: Observable<T>): Observable<T> {
    return obs.pipe(catchError(err => {
      console.error('[AdminApi]', err);
      return throwError(() => err);
    }));
  }

  // ── Categories ────────────────────────────────────────────────────────

  getCategories(): Observable<AdminCategory[]> {
    return this.handle(this.http.get<AdminCategory[]>(`${API}/api/admin/categories`, { headers: this.headers() }));
  }

  createCategory(name: string, description?: string): Observable<AdminCategory> {
    return this.handle(this.http.post<AdminCategory>(`${API}/api/admin/categories`, { name, description }, { headers: this.headers() }));
  }

  updateCategory(id: string, name: string, description: string | undefined, isActive: boolean): Observable<AdminCategory> {
    return this.handle(this.http.put<AdminCategory>(`${API}/api/admin/categories/${id}`, { name, description, isActive }, { headers: this.headers() }));
  }

  deleteCategory(id: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/categories/${id}`, { headers: this.headers() }));
  }

  // ── Products ─────────────────────────────────────────────────────────

  getProducts(page = 1, pageSize = 50): Observable<{ total: number; items: AdminProduct[] }> {
    return this.handle(this.http.get<any>(`${API}/api/admin/products?page=${page}&pageSize=${pageSize}`, { headers: this.headers() }));
  }

  createProduct(req: CreateProductRequest): Observable<AdminProduct> {
    return this.handle(this.http.post<AdminProduct>(`${API}/api/admin/products`, req, { headers: this.headers() }));
  }

  updateProduct(id: string, req: UpdateProductRequest): Observable<AdminProduct> {
    return this.handle(this.http.put<AdminProduct>(`${API}/api/admin/products/${id}`, req, { headers: this.headers() }));
  }

  deleteProduct(id: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/products/${id}`, { headers: this.headers() }));
  }

  uploadProductImage(productId: string, file: File, isPrimary = false): Observable<AdminProductImage> {
    const form = new FormData();
    form.append('file', file);
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`,
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
    return this.handle(this.http.post<AdminProductImage>(
      `${API}/api/admin/products/${productId}/images?isPrimary=${isPrimary}`,
      form, { headers }
    ));
  }

  deleteProductImage(productId: string, imageId: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/products/${productId}/images/${imageId}`, { headers: this.headers() }));
  }

  setPrimaryImage(productId: string, imageId: string): Observable<void> {
    return this.handle(this.http.put<void>(`${API}/api/admin/products/${productId}/images/${imageId}/primary`, {}, { headers: this.headers() }));
  }

  // ── Site Content ─────────────────────────────────────────────────────

  getAllContent(): Observable<SiteContentSummary[]> {
    return this.handle(this.http.get<SiteContentSummary[]>(`${API}/api/admin/content`, { headers: this.headers() }));
  }

  uploadSectionImage(
    file: File, section: string, contentKey: string,
    altText: string, sortOrder: number
  ): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`,
      'X-Admin-PreAuth-Key': this.auth.getPreAuthKey(),
    });
    const params = `section=${encodeURIComponent(section)}&contentKey=${encodeURIComponent(contentKey)}&altText=${encodeURIComponent(altText)}&sortOrder=${sortOrder}`;
    return this.handle(this.http.post<any>(`${API}/api/admin/content/image?${params}`, form, { headers }));
  }

  upsertTextContent(contentKey: string, sectionName: string, textValue: string, sortOrder = 0): Observable<void> {
    return this.handle(this.http.put<void>(`${API}/api/admin/content/text`, { contentKey, sectionName, textValue, sortOrder }, { headers: this.headers() }));
  }

  deleteContent(id: string): Observable<void> {
    return this.handle(this.http.delete<void>(`${API}/api/admin/content/${id}`, { headers: this.headers() }));
  }

  toggleContent(id: string): Observable<{ id: string; isActive: boolean }> {
    return this.handle(this.http.put<any>(`${API}/api/admin/content/${id}/toggle`, {}, { headers: this.headers() }));
  }

  // ── Order API methods ───────────────────────────────────────────────
getOrders(page = 1, pageSize = 20, status?: string): Observable<{ total: number; items: AdminOrderListItem[] }> {
  let params = `page=${page}&pageSize=${pageSize}`;
  if (status) params += `&status=${status}`;
  return this.handle(this.http.get<any>(`${API}/api/admin/orders?${params}`, { headers: this.headers() }));
}

getOrder(id: string): Observable<AdminOrderDetail> {
  return this.handle(this.http.get<AdminOrderDetail>(`${API}/api/admin/orders/${id}`, { headers: this.headers() }));
}

updateOrderStatus(id: string, status: string): Observable<any> {
  return this.handle(this.http.put(`${API}/api/admin/orders/${id}/status`, { status }, { headers: this.headers() }));
}

updateOrderPayment(id: string, paymentStatus: string, transactionId?: string): Observable<any> {
  return this.handle(this.http.put(`${API}/api/admin/orders/${id}/payment`, { paymentStatus, transactionId }, { headers: this.headers() }));
}

addOrderMessage(id: string, messageText: string): Observable<AdminOrderMessage> {
  return this.handle(this.http.post<AdminOrderMessage>(`${API}/api/admin/orders/${id}/messages`, { messageText }, { headers: this.headers() }));
}

downloadInvoice(id: string): Observable<Blob> {
  return this.http.get(`${API}/api/admin/orders/${id}/invoice`, {
    headers: this.headers(),
    responseType: 'blob'
  }).pipe(catchError(err => {
    console.error('[AdminApi] Invoice download error', err);
    return throwError(() => err);
  }));
}
}