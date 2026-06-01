import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-track-order-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div id="track-modal" [class.active]="open">
      <div class="modal-overlay" (click)="close()"></div>
      <div class="track-card">
        <button class="modal-close-btn" type="button" (click)="close()">✕</button>
        <h3>Track Your Order</h3>
        <p>Enter your Order ID or phone number to see the latest status of your order.</p>
        <form class="track-input-group" (submit)="lookup($event)">
          <input name="id" placeholder="Enter Order ID (e.g. ORD-2026-X8B9)" />
          <input name="phone" placeholder="Or enter Phone Number" />
          <button class="btn-track-search" type="submit">Search</button>
        </form>

        <div class="track-result" [class.show]="!!order">
          <div class="track-result-header">
            <div class="track-order-id"><strong>{{ order?.id }}</strong><br />Placed on {{ order?.created_at | date:'d MMMM yyyy' }}</div>
            <span class="track-status-badge" [class.status-pending]="order?.status === 'Pending Payment'" [class.status-verified]="order?.status !== 'Pending Payment'">{{ order?.status }}</span>
          </div>
          <div class="track-timeline">
            <div class="track-step done">
              <div class="track-step-dot"></div>
              <div class="track-step-label">Order Placed</div>
            </div>
            <div class="track-step" [class.done]="order?.status !== 'Pending Payment'">
              <div class="track-step-dot"></div>
              <div class="track-step-label">Payment Verified</div>
            </div>
            <div class="track-step" [class.done]="order?.status === 'Dispatched' || order?.status === 'Delivered'">
              <div class="track-step-dot"></div>
              <div class="track-step-label">Dispatched</div>
            </div>
            <div class="track-step" [class.done]="order?.status === 'Delivered'">
              <div class="track-step-dot"></div>
              <div class="track-step-label">Delivered</div>
            </div>
          </div>

          <div class="timeline-messages" *ngIf="order?.messages?.length">
            <div class="msg" *ngFor="let message of order.messages"><strong>{{ message.sender }}</strong>: {{ message.message_text }}</div>
          </div>

          <form class="note-row" (submit)="sendNote($event)">
            <input name="note" placeholder="Type a note to the owner..." />
            <button type="submit" class="btn-note">Send Note</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `:host{position:fixed;inset:0;z-index:800;pointer-events:none}
    #track-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;pointer-events:none;transition:opacity 0.3s}
    #track-modal.active{opacity:1;pointer-events:auto}
    .modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)}
    .track-card{position:relative;z-index:1;background:#fff;border-radius:20px;padding:2rem 2rem 2.5rem;max-width:520px;width:100%;box-shadow:0 24px 64px rgba(34,34,34,0.2);transform:translateY(20px);transition:transform 0.3s}
    #track-modal.active .track-card{transform:translateY(0)}
    .track-card h3{font-family:var(--font-display);font-size:1.4rem;color:var(--color-charcoal);margin-bottom:0.3rem}
    .track-card > p{font-size:0.88rem;color:var(--color-body);margin-bottom:1.5rem}
    .track-input-group{display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:1.25rem}
    .track-input-group input{flex:1;min-width:160px;padding:0.7rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition)}
    .track-input-group input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px rgba(136,173,53,0.12)}
    .btn-track-search{background:var(--color-primary);color:#fff;border:none;padding:0.7rem 1.3rem;border-radius:var(--radius-sm);font-weight:600;transition:var(--transition)}
    .btn-track-search:hover{background:var(--color-primary-d)}
    .track-result{background:var(--color-sage);border-radius:12px;padding:1.25rem;display:none}
    .track-result.show{display:block}
    .track-result-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:1rem}
    .track-order-id{font-size:0.88rem;color:var(--color-body)}
    .track-order-id strong{color:var(--color-charcoal);font-size:1rem}
    .track-status-badge{padding:0.3rem 0.85rem;border-radius:50px;font-size:0.78rem;font-weight:600;white-space:nowrap}
    .status-pending{background:rgba(245,158,11,0.15);color:#d97706}
    .status-verified{background:rgba(136,173,53,0.15);color:var(--color-primary-d)}
    .track-timeline{display:flex;justify-content:space-between;margin-top:1rem;position:relative;gap:0.75rem}
    .track-timeline::before{content:'';position:absolute;top:11px;left:10%;right:10%;height:2px;background:var(--color-border)}
    .track-step{text-align:center;position:relative;z-index:1;flex:1}
    .track-step-dot{width:22px;height:22px;border-radius:50%;background:var(--color-border);margin:0 auto 0.4rem;border:3px solid #fff;box-shadow:0 0 0 2px var(--color-border)}
    .track-step.done .track-step-dot{background:var(--color-primary);box-shadow:0 0 0 2px var(--color-primary)}
    .track-step-label{font-size:0.72rem;color:var(--color-body);font-weight:500}
    .timeline-messages{margin-top:1rem;border-top:1px solid rgba(209,209,209,0.5);padding-top:0.75rem}
    .msg{font-size:0.86rem;color:var(--color-body);padding:0.2rem 0}
    .note-row{display:flex;gap:0.6rem;margin-top:1rem}
    .note-row input{flex:1;padding:0.7rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:var(--font-ui);outline:none;transition:var(--transition)}
    .note-row input:focus{border-color:var(--color-primary)}
    .btn-note{background:var(--color-primary);color:#fff;border:none;padding:0.7rem 1rem;border-radius:var(--radius-sm);font-weight:600;transition:var(--transition)}
    .btn-note:hover{background:var(--color-primary-d)}
    .modal-close-btn{position:absolute;top:1.25rem;right:1.25rem;background:var(--color-bg);border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
    .modal-close-btn:hover{background:var(--color-border)}
    @media (max-width:600px){.track-card{padding:1.5rem}.track-input-group,.note-row{flex-direction:column}.track-timeline{flex-wrap:wrap}.track-timeline::before{left:12%;right:12%}}
    `
  ]
})
export class TrackOrderModalComponent {
  open = false;
  order: any = null;
  constructor(private state: AppStateService) {
    this.state.trackModal$.subscribe(v => { this.open = v; if (!v) this.order = null; });
  }

  close() { this.state.hideTrackModal(); }

  lookup(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const id = (form.elements.namedItem('id') as HTMLInputElement).value.trim();
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    if (id) this.order = this.state.findOrderById(id);
    else if (phone) {
      const list = this.state.findOrdersByPhone(phone);
      this.order = list.length ? list[0] : null;
    }
  }

  sendNote(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const note = (form.elements.namedItem('note') as HTMLInputElement).value.trim();
    if (!note || !this.order) return;
    this.state.addMessage(this.order.id, 'Customer', note);
    this.order = this.state.findOrderById(this.order.id);
    form.reset();
  }
}
