import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorCode, errorMessage } from '../core/format';
import { ToastService } from '../core/toast.service';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      <h1>Sign in</h1>
      <p class="muted sub">Welcome back. Your hall tickets and results are where you left them.</p>

      @if (expired()) {
        <div class="alert alert-info">Your session ended. Sign in again to continue.</div>
      }
      @if (error()) {
        <div class="alert alert-danger">
          {{ error() }}
          @if (unverified()) {
            <div class="resend">
              <button type="button" class="link" (click)="resend()" [disabled]="resending()">
                {{ resending() ? 'Sending…' : 'Send a new confirmation link' }}
              </button>
            </div>
          }
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <div class="spread"><label for="password" class="label">Password</label><a routerLink="/forgot-password" class="link small">Forgot password?</a></div>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
          @if (busy()) { <span class="spinner"></span> } Sign in
        </button>
      </form>

      <p class="switch">New to Qubit? <a routerLink="/register" class="link">Create an account</a></p>
    </app-auth-frame>
  `,
  styles: `
    h1 { font-size: 30px; }
    .sub { margin: 8px 0 28px; }
    .alert { margin-bottom: 18px; }
    .resend { margin-top: 6px; }
    .switch { margin-top: 24px; font-size: 14px; color: var(--muted); }
  `,
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  /** Query params bound via withComponentInputBinding. */
  next = input<string>();
  expired = input<string>();

  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected unverified = signal(false);
  protected resending = signal(false);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.unverified.set(false);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        const target = this.next();
        this.router.navigateByUrl(target && target.startsWith('/') ? target : this.auth.homeRoute());
      },
      error: (err) => {
        this.busy.set(false);
        this.unverified.set(errorCode(err) === 'EMAIL_NOT_VERIFIED');
        this.error.set(errorMessage(err));
      },
    });
  }

  resend(): void {
    const email = this.form.controls.email.value.trim();
    if (!email) return;
    this.resending.set(true);
    this.auth.resendVerification(email).subscribe({
      next: (r) => { this.resending.set(false); this.toast.ok(r.message); },
      error: (e) => { this.resending.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
