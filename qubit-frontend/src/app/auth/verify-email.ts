import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/format';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, AuthFrame],
  template: `
    <app-auth-frame>
      @switch (state()) {
        @case ('working') {
          <div class="row"><span class="spinner"></span><span class="muted">Confirming your email…</span></div>
        }
        @case ('done') {
          <span class="badge badge-ok">Confirmed</span>
          <h1>You're all set</h1>
          <p class="muted sub">Your email is confirmed and a welcome note is on its way. Sign in to pick your first assessment.</p>
          <a routerLink="/login" class="btn btn-primary btn-lg">Sign in</a>
        }
        @case ('error') {
          <span class="badge badge-danger">Link problem</span>
          <h1>That link didn't work</h1>
          <p class="muted sub">{{ message() }}</p>
          <a routerLink="/login" class="btn btn-ghost">Back to sign in</a>
        }
      }
    </app-auth-frame>
  `,
  styles: `
    h1 { font-size: 30px; margin-top: 14px; }
    .sub { margin: 10px 0 26px; }
  `,
})
export class VerifyEmailPage implements OnInit {
  private auth = inject(AuthService);
  token = input<string>();
  protected state = signal<'working' | 'done' | 'error'>('working');
  protected message = signal('');

  ngOnInit(): void {
    const t = this.token();
    if (!t) {
      this.state.set('error');
      this.message.set('The confirmation link is missing its token. Open the link from your email again.');
      return;
    }
    this.auth.verify(t).subscribe({
      next: () => this.state.set('done'),
      error: (err) => { this.state.set('error'); this.message.set(errorMessage(err)); },
    });
  }
}
