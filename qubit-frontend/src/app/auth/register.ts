import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/format';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      <h1>Create your account</h1>
      <p class="muted sub">Free to join. You'll confirm your email before your first sign-in.</p>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <div class="field">
          <label for="name">Full name</label>
          <input id="name" class="input" formControlName="fullName" autocomplete="name" placeholder="As it should appear on your hall ticket" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label for="phone">Phone <span class="faint">(optional)</span></label>
          <input id="phone" class="input" type="tel" formControlName="phone" autocomplete="tel" placeholder="+91" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
          <div class="meter" [attr.data-level]="strength()">
            <i></i><i></i><i></i>
            <span>{{ strengthLabel() }}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
          @if (busy()) { <span class="spinner"></span> } Create account
        </button>
      </form>

      <p class="switch">Already registered? <a routerLink="/login" class="link">Sign in</a></p>
    </app-auth-frame>
  `,
  styles: `
    h1 { font-size: 30px; }
    .sub { margin: 8px 0 28px; }
    .alert { margin-bottom: 18px; }
    .switch { margin-top: 24px; font-size: 14px; color: var(--muted); }
    .meter { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    .meter i { height: 3px; width: 36px; border-radius: 2px; background: var(--line); }
    .meter span { font-size: 12px; color: var(--muted); margin-left: 8px; }
    .meter[data-level="1"] i:nth-child(1) { background: var(--danger); }
    .meter[data-level="2"] i:nth-child(-n+2) { background: var(--warn); }
    .meter[data-level="3"] i { background: var(--ok); }
  `,
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  private password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  protected strength = computed(() => {
    const p = this.password();
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++;
    if (p.length >= 12 || /[^A-Za-z0-9]/.test(p)) s++;
    return Math.max(1, s);
  });

  protected strengthLabel = computed(() => {
    const p = this.password();
    if (!p) return 'At least 8 characters, with a letter and a number';
    return ['Too weak', 'Too weak', 'Okay', 'Strong'][this.strength()];
  });

  submit(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.form.controls.password.invalid && v.fullName && v.email
        ? 'Password must be at least 8 characters.'
        : 'Fill in your name, a valid email and a password.');
      return;
    }
    if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) {
      this.error.set('Password needs at least one letter and one number.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.auth.register({ fullName: v.fullName.trim(), email: v.email.trim(), password: v.password, phone: v.phone.trim() || undefined })
      .subscribe({
        next: () => this.router.navigate(['/check-email'], { queryParams: { email: v.email.trim() } }),
        error: (err) => { this.busy.set(false); this.error.set(errorMessage(err)); },
      });
  }
}
