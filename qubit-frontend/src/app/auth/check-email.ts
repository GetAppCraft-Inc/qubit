import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/format';
import { ToastService } from '../core/toast.service';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-check-email',
  imports: [RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      <div class="envelope" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48"><rect x="5" y="11" width="38" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m7 14 17 12 17-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
      <h1>Check your inbox</h1>
      <p class="muted sub">
        We sent a confirmation link to <strong class="addr">{{ email() || 'your email' }}</strong>.
        Open it to activate your account — it's valid for 24 hours.
      </p>
      <ul class="tips">
        <li>Can't find it? Look in Spam or Promotions.</li>
        <li>Using a work or college address? Some filters hold mail for a few minutes.</li>
      </ul>
      <div class="row row-wrap">
        <button class="btn btn-ghost" type="button" (click)="resend()" [disabled]="busy() || !email()">
          @if (busy()) { <span class="spinner"></span> } Resend link
        </button>
        <a routerLink="/login" class="btn btn-primary">Go to sign in</a>
      </div>
    </app-auth-frame>
  `,
  styles: `
    .envelope { color: var(--brand); margin-bottom: 18px; }
    h1 { font-size: 30px; }
    .sub { margin: 10px 0 18px; }
    .addr { color: var(--ink); font-weight: 600; word-break: break-all; }
    .tips { margin: 0 0 28px; padding-left: 18px; color: var(--ink-2); font-size: 14px; display: grid; gap: 6px; }
  `,
})
export class CheckEmailPage {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  email = input<string>();
  protected busy = signal(false);

  resend(): void {
    const e = this.email();
    if (!e) return;
    this.busy.set(true);
    this.auth.resendVerification(e).subscribe({
      next: (r) => { this.busy.set(false); this.toast.ok(r.message); },
      error: (err) => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }
}
