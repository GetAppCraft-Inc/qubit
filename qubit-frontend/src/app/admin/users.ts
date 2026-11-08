import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage, IstPipe } from '../core/format';
import { Role, User } from '../core/models';
import { ToastService } from '../core/toast.service';

const ROLE_LABEL: Record<Role, string> = {
  QUBIT_USER: 'Candidate',
  QUBIT_ADMIN: 'Admin',
  QUBIT_SUPERADMIN: 'Superadmin',
};

@Component({
  selector: 'app-users',
  imports: [IstPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Users &amp; roles</h1>
          <p>Promote staff to admin, or suspend an account. Suspended users can't sign in.</p>
        </div>
        <input class="input search" type="search" placeholder="Search name or email" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>

      <div class="counts mono small">
        <span>{{ count('QUBIT_USER') }} candidates</span>
        <span>{{ count('QUBIT_ADMIN') }} admins</span>
        <span>{{ count('QUBIT_SUPERADMIN') }} superadmins</span>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      <div class="card table-wrap">
        <table class="table">
          <thead><tr><th>User</th><th>Role</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th>Status</th></tr></thead>
          <tbody>
            @for (u of filtered(); track u.id) {
              <tr [class.off]="!u.active">
                <td><div class="name">{{ u.fullName }}</div><div class="muted small">{{ u.email }}</div></td>
                <td>
                  @if (u.id === me()) {
                    <span class="badge badge-brand">{{ roleLabel[u.role] }} · you</span>
                  } @else {
                    <select class="select sm" [value]="u.role" (change)="setRole(u, $any($event.target).value)">
                      @for (r of roles; track r) { <option [value]="r">{{ roleLabel[r] }}</option> }
                    </select>
                  }
                </td>
                <td>@if (u.emailVerified) { <span class="badge badge-ok">Verified</span> } @else { <span class="badge">Pending</span> }</td>
                <td class="nowrap small">{{ u.createdAt | ist: 'dateShort' }}</td>
                <td class="nowrap small">{{ u.lastLoginAt | ist }}</td>
                <td>
                  @if (u.id !== me()) {
                    <button type="button" [class]="u.active ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'" (click)="toggle(u)">
                      {{ u.active ? 'Suspend' : 'Reactivate' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted">No users match.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .search { width: 260px; }
    .counts { display: flex; gap: 18px; color: var(--muted); margin: -12px 0 16px; }
    .name { font-weight: 550; }
    .select.sm { height: 32px; font-size: 13px; width: 150px; }
    tr.off td { opacity: .55; }
  `,
})
export class UsersPage implements OnInit {
  private api = inject(Api);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly roles = Object.keys(ROLE_LABEL) as Role[];
  protected users = signal<User[]>([]);
  protected q = signal('');
  protected error = signal<string | null>(null);
  protected me = computed(() => this.auth.user()?.id);

  protected filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.users().filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : this.users();
  });

  ngOnInit(): void {
    this.api.users().subscribe({ next: (u) => this.users.set(u), error: (e) => this.error.set(errorMessage(e)) });
  }

  count(r: Role): number { return this.users().filter((u) => u.role === r).length; }

  setRole(u: User, role: Role): void {
    this.update(u, { role }, `${u.fullName} is now ${ROLE_LABEL[role]}.`);
  }

  toggle(u: User): void {
    this.update(u, { active: !u.active }, u.active ? `${u.fullName} suspended.` : `${u.fullName} reactivated.`);
  }

  private update(u: User, body: { role?: Role; active?: boolean }, msg: string): void {
    this.api.patchUser(u.id, body).subscribe({
      next: (x) => { this.users.update((list) => list.map((y) => (y.id === x.id ? x : y))); this.toast.ok(msg); },
      error: (e) => { this.toast.error(errorMessage(e)); this.users.update((l) => [...l]); },
    });
  }
}
