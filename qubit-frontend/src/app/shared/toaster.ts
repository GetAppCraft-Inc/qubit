import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toaster',
  template: `
    <div class="toaster" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.kind" role="status">
          <span class="mark"></span>
          <span class="text">{{ t.text }}</span>
          <button type="button" (click)="toasts.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toaster { position: fixed; right: 20px; bottom: 20px; z-index: 300; display: flex; flex-direction: column; gap: 8px; max-width: min(380px, calc(100vw - 32px)); }
    .toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; border-radius: 10px;
      background: var(--ink); color: #f2f1ee; font-size: 14px; box-shadow: var(--shadow-3); animation: rise .2s ease-out; }
    .mark { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex: none; background: #9a8cff; }
    .toast-ok .mark { background: #4fd18b; }
    .toast-error .mark { background: #ff7a6b; }
    .text { flex: 1; line-height: 1.45; }
    button { background: none; border: 0; color: #a9a7b0; font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px; }
    button:hover { color: #fff; }
    @media (max-width: 600px) { .toaster { left: 16px; right: 16px; bottom: 16px; max-width: none; } }
  `,
})
export class Toaster {
  protected toasts = inject(ToastService);
}
