import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';

/** Requests flagged with this don't trigger the global "session expired → sign in" redirect. */
export const SILENT_401 = new HttpContextToken<boolean>(() => false);
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { LoginResponse, MessageResponse, User } from './models';

const TOKEN_KEY = 'qubit.token';
const USER_KEY = 'qubit.user';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);

  readonly isLoggedIn = computed(() => !!this.token());
  readonly isStaff = computed(() => {
    const r = this.user()?.role;
    return r === 'QUBIT_ADMIN' || r === 'QUBIT_SUPERADMIN';
  });
  readonly isSuper = computed(() => this.user()?.role === 'QUBIT_SUPERADMIN');

  constructor() {
    const t = safeGet(TOKEN_KEY);
    if (t && !tokenExpired(t)) {
      this.token.set(t);
      try { this.user.set(JSON.parse(safeGet(USER_KEY) ?? 'null')); } catch { this.user.set(null); }
    } else {
      safeSet(TOKEN_KEY, null);
      safeSet(USER_KEY, null);
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        this.token.set(res.token);
        this.user.set(res.user);
        safeSet(TOKEN_KEY, res.token);
        safeSet(USER_KEY, JSON.stringify(res.user));
      }),
    );
  }

  register(body: { fullName: string; email: string; password: string; phone?: string }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/auth/register', body);
  }

  verify(token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/auth/verify', { token });
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/auth/resend-verification', { email });
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/auth/reset-password', { token, password });
  }

  /**
   * Refreshes the cached profile on app start. A stale/revoked token just clears the session
   * quietly — it must not bounce someone browsing the landing page to the sign-in screen.
   */
  refreshMe(): void {
    if (!this.token()) return;
    this.http.get<User>('/api/me', { context: new HttpContext().set(SILENT_401, true) }).subscribe({
      next: (u) => this.setUser(u),
      error: (e) => { if (e?.status === 401) this.logout(false); },
    });
  }

  setUser(u: User): void {
    this.user.set(u);
    safeSet(USER_KEY, JSON.stringify(u));
  }

  homeRoute(): string {
    return this.isStaff() ? '/admin' : '/app';
  }

  logout(redirect = true): void {
    this.token.set(null);
    this.user.set(null);
    safeSet(TOKEN_KEY, null);
    safeSet(USER_KEY, null);
    if (redirect) this.router.navigateByUrl('/login');
  }

  /** Drops the session after a 401 and sends the user back to sign in. */
  expire(returnUrl: string): void {
    this.logout(false);
    this.router.navigate(['/login'], { queryParams: { next: returnUrl, expired: 1 } });
  }
}
