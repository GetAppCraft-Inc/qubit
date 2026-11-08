import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/format';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      @if (sent()) {
        <span class="badge badge-ok">Check your inbox</span>
        <h1>Reset link sent</h1>
        <p class="muted sub">If an account exists for <strong class="ink">{{ email() }}</strong>, you'll get an email with a link to choose a new password. It works once and expires in an hour.</p>
        <a routerLink="/login" class="btn btn-primary">Back to sign in</a>
      } @else {
        <h1>Forgot your password?</h1>
        <p class="muted sub">Enter the email you registered with and we'll send you a reset link.</p>
        @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
        <form class="stack" (submit)="$event.preventDefault(); submit()" novalidate>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" class="input" type="email" autocomplete="email" placeholder="you@example.com"
                   [value]="email()" (input)="email.set($any($event.target).value)" />
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
            @if (busy()) { <span class="spinner"></span> } Send reset link
          </button>
        </form>
        <p class="switch">Remembered it? <a routerLink="/login" class="link">Sign in</a></p>
      }
    </app-auth-frame>
  `,
  styles: `
    h1 { font-size: 30px; margin-top: 6px; }
    .sub { margin: 8px 0 26px; }
    .ink { color: var(--ink); word-break: break-all; }
    .alert { margin-bottom: 16px; }
    .switch { margin-top: 24px; font-size: 14px; color: var(--muted); }
  `,
})
export class ForgotPasswordPage {
  private auth = inject(AuthService);
  protected email = signal('');
  protected busy = signal(false);
  protected sent = signal(false);
  protected error = signal<string | null>(null);

  submit(): void {
    const e = this.email().trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) { this.error.set('Enter a valid email address.'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.auth.forgotPassword(e).subscribe({
      next: () => { this.busy.set(false); this.sent.set(true); },
      error: (err) => { this.busy.set(false); this.error.set(errorMessage(err)); },
    });
  }
}
