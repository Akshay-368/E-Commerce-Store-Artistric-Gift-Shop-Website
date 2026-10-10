import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';

/**
 * SectionSlideshowComponent
 *
 * Displays a list of image URLs as an automatic slideshow with a smooth
 * crossfade transition. Falls back to a single static image if only one
 * URL is provided.
 *
 * Usage:
 *   <app-section-slideshow [images]="heroImages" [interval]="5000"></app-section-slideshow>
 */
@Component({
  selector: 'app-section-slideshow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slideshow-host" [class.has-multiple]="images.length > 1">
      <div
        *ngFor="let img of images; let i = index"
        class="slide"
        [class.active]="i === activeIndex"
        [style.background-image]="'url(' + img + ')'"
        [attr.aria-hidden]="i !== activeIndex ? 'true' : null"
      ></div>

      <!-- Dot indicators — only shown when > 1 image -->
      <div class="slide-dots" *ngIf="images.length > 1" role="tablist" aria-label="Slideshow navigation">
        <button
          *ngFor="let img of images; let i = index"
          class="dot"
          [class.active]="i === activeIndex"
          (click)="goTo(i)"
          role="tab"
          [attr.aria-selected]="i === activeIndex"
          [attr.aria-label]="'Slide ' + (i + 1)"
        ></button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents }

    .slideshow-host {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .slide {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      opacity: 0;
      transition: opacity 1s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    .slide.active {
      opacity: 1;
    }

    .slide-dots {
      position: absolute;
      bottom: 1.4rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 0.5rem;
      z-index: 10;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      border: 1.5px solid rgba(255,255,255,0.8);
      cursor: pointer;
      padding: 0;
      transition: all 0.3s ease;
    }

    .dot.active {
      background: #fff;
      transform: scale(1.3);
    }
  `]
})
export class SectionSlideshowComponent implements OnInit, OnDestroy {
  /** Image URLs to cycle through */
  @Input() images: string[] = [];

  /** Auto-advance interval in ms (default 5 seconds) */
  @Input() interval = 5000;

  activeIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (this.images.length > 1) {
      this.timer = setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.images.length;
      }, this.interval);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  goTo(index: number): void {
    this.activeIndex = index;
    // Restart timer after manual navigation
    if (this.timer) clearInterval(this.timer);
    if (this.images.length > 1) {
      this.timer = setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.images.length;
      }, this.interval);
    }
  }
}