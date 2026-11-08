import { Component, inject, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage, IstPipe } from '../core/format';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-account',
  imports: [IstPipe],
  template: `
    <div class="page page-narrow">
      <div class="page-head">
        <div>
          <h1>Account</h1>
          <p>Your name appears on hall tickets exactly as it's written here.</p>
        </div>
      </div>

      <section class="fs">
        <div class="fs-label"><h3>Profile</h3><p>{{ auth.user()?.email }}<br />Member since {{ auth.user()?.createdAt | ist: 'date' }}</p></div>
        <form class="card card-pad stack" (submit)="$event.preventDefault(); saveProfile()">
          <div class="field">
            <label for="name">Full name</label>
            <input id="name" class="input" [value]="name()" (input)="name.set($any($event.target).value)" autocomplete="name" />
          </div>
          <div class="field">
            <label for="phone">Phone <span class="faint">(optional)</span></label>
            <input id="phone" class="input" type="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" autocomplete="tel" />
          </div>
          <div class="row" style="justify-content: flex-end">
            <button class="btn btn-primary" type="submit" [disabled]="busy()">Save profile</button>
          </div>
        </form>
      </section>

      <section class="fs">
        <div class="fs-label"><h3>Password</h3><p>Use at least 8 characters with a letter and a number.</p></div>
        <form class="card card-pad stack" (submit)="$event.preventDefault(); changePassword()">
          @if (pwError()) { <div class="alert alert-danger">{{ pwError() }}</div> }
          <div class="field">
            <label for="cur">Current password</label>
            <input id="cur" class="input" type="password" autocomplete="current-password" [value]="cur()" (input)="cur.set($any($event.target).value)" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="new">New password</label>
              <input id="new" class="input" type="password" autocomplete="new-password" [value]="next()" (input)="next.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label for="new2">Confirm new password</label>
              <input id="new2" class="input" type="password" autocomplete="new-password" [value]="next2()" (input)="next2.set($any($event.target).value)" />
            </div>
          </div>
          <div class="row" style="justify-content: flex-end">
            <button class="btn btn-primary" type="submit" [disabled]="busy()">Change password</button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .fs { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 28px; padding: 22px 0; border-top: 1px solid var(--line); }
    .fs-label h3 { font-size: 15px; }
    .fs-label p { font-size: 13px; color: var(--muted); margin-top: 4px; word-break: break-all; }
    @media (max-width: 760px) { .fs { grid-template-columns: 1fr; gap: 12px; } }
  `,
})
export class AccountPage implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(Api);
  private toast = inject(ToastService);

  protected name = signal('');
  protected phone = signal('');
  protected cur = signal('');
  protected next = signal('');
  protected next2 = signal('');
  protected busy = signal(false);
  protected pwError = signal<string | null>(null);

  ngOnInit(): void {
    this.name.set(this.auth.user()?.fullName ?? '');
    this.phone.set(this.auth.user()?.phone ?? '');
  }

  saveProfile(): void {
    if (!this.name().trim()) { this.toast.error('Name can’t be empty.'); return; }
    this.busy.set(true);
    this.api.updateProfile({ fullName: this.name().trim(), phone: this.phone().trim() || null }).subscribe({
      next: (u) => { this.busy.set(false); this.auth.setUser(u); this.toast.ok('Profile saved.'); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  changePassword(): void {
    const p = this.next();
    this.pwError.set(null);
    if (!this.cur()) { this.pwError.set('Enter your current password.'); return; }
    if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) { this.pwError.set('New password needs 8+ characters with a letter and a number.'); return; }
    if (p !== this.next2()) { this.pwError.set('The new passwords don’t match.'); return; }
    this.busy.set(true);
    this.api.changePassword(this.cur(), p).subscribe({
      next: () => {
        this.busy.set(false);
        this.cur.set(''); this.next.set(''); this.next2.set('');
        this.toast.ok('Password changed.');
      },
      error: (e) => { this.busy.set(false); this.pwError.set(errorMessage(e)); },
    });
  }
}
