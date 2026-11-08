import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/format';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      @if (done()) {
        <span class="badge badge-ok">Password updated</span>
        <h1>You're back in</h1>
        <p class="muted sub">Your new password is set. Sign in with it to continue.</p>
        <a routerLink="/login" class="btn btn-primary btn-lg">Sign in</a>
      } @else if (!token()) {
        <span class="badge badge-danger">Link problem</span>
        <h1>This link is incomplete</h1>
        <p class="muted sub">Open the reset link from your email again, or request a new one.</p>
        <a routerLink="/forgot-password" class="btn btn-ghost">Request a new link</a>
      } @else {
        <h1>Choose a new password</h1>
        <p class="muted sub">At least 8 characters, with a letter and a number.</p>
        @if (error()) {
          <div class="alert alert-danger">{{ error() }}
            @if (expired()) { <a routerLink="/forgot-password" class="link">Request a new link</a> }
          </div>
        }
        <form class="stack" (submit)="$event.preventDefault(); submit()" novalidate>
          <div class="field">
            <label for="pw">New password</label>
            <input id="pw" class="input" type="password" autocomplete="new-password" [value]="pw()" (input)="pw.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label for="pw2">Confirm new password</label>
            <input id="pw2" class="input" type="password" autocomplete="new-password" [value]="pw2()" (input)="pw2.set($any($event.target).value)" />
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
            @if (busy()) { <span class="spinner"></span> } Update password
          </button>
        </form>
      }
    </app-auth-frame>
  `,
  styles: `
    h1 { font-size: 30px; margin-top: 6px; }
    .sub { margin: 8px 0 26px; }
    .alert { margin-bottom: 16px; }
  `,
})
export class ResetPasswordPage {
  private auth = inject(AuthService);
  token = input<string>();
  protected pw = signal('');
  protected pw2 = signal('');
  protected busy = signal(false);
  protected done = signal(false);
  protected expired = signal(false);
  protected error = signal<string | null>(null);

  submit(): void {
    const p = this.pw();
    if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) { this.error.set('Use at least 8 characters with a letter and a number.'); return; }
    if (p !== this.pw2()) { this.error.set('The two passwords don’t match.'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token()!, p).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); },
      error: (err) => {
        this.busy.set(false);
        const msg = errorMessage(err);
        this.expired.set(/expired|invalid/i.test(msg));
        this.error.set(msg);
      },
    });
  }
}
