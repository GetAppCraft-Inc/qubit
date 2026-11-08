import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-candidate-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  template: `
    <div class="shell" [class.open]="open()">
      <header class="mobile-bar no-print">
        <button type="button" class="burger" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <a routerLink="/app" class="mb-brand"><app-logo [size]="22" /></a>
      </header>

      <aside class="side no-print" aria-label="Main">
        <a routerLink="/app" class="brand"><app-logo [size]="24" /></a>

        <nav>
          <a routerLink="/app" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">
            <svg viewBox="0 0 16 16"><path d="M2 7.5 8 2.5l6 5V14H10v-4H6v4H2z"/></svg>Home
          </a>

          <p class="group">Learn</p>
          <a routerLink="/app/learn" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M2 3.5h5a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 0 7 12.5H2zM14 3.5H9.5A1.5 1.5 0 0 0 8 5v9a1.5 1.5 0 0 1 1.5-1.5H14z"/></svg>My learning
          </a>
          <a routerLink="/app/courses" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="9" rx="1.5"/><path d="m6.5 5.8 3.5 1.7-3.5 1.7z"/><path d="M5 14h6"/></svg>Courses
          </a>

          <p class="group">Tests</p>
          <a routerLink="/app/exams" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 11h5"/></svg>Assessments
          </a>
          <a routerLink="/app/registrations" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M2 4h12v8H2z"/><path d="M4.5 6.5v3M6 6.5v3M7.5 6.5v3M9.5 6.5v3M11.5 6.5v3"/></svg>Hall tickets
          </a>
          <a routerLink="/app/results" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M2 14h12M4 11V8M7 11V5M10 11V7M13 11V3"/></svg>Results
          </a>
        </nav>

        <div class="foot">
          @if (auth.isStaff()) {
            <a routerLink="/admin" class="btn btn-ghost btn-sm btn-block">Admin console</a>
          }
          <a routerLink="/app/account" routerLinkActive="on-me" class="me">
            <span class="avatar" aria-hidden="true">{{ initials() }}</span>
            <span class="me-text"><strong>{{ auth.user()?.fullName }}</strong><small>{{ auth.user()?.email }}</small></span>
          </a>
          <button type="button" class="link small signout" (click)="auth.logout()">Sign out</button>
        </div>
      </aside>

      <div class="scrim" (click)="open.set(false)"></div>

      <main class="main"><router-outlet /></main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
    .side { position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; padding: 20px 14px 16px;
      border-right: 1px solid var(--line); background: #faf9f5; }
    .brand { display: inline-flex; padding: 2px 8px 22px; }
    nav { display: flex; flex-direction: column; gap: 1px; }
    .group { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--faint); padding: 16px 10px 6px; }
    nav a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; text-decoration: none; font-size: 14px; font-weight: 520; color: var(--ink-2); border: 1px solid transparent; }
    nav a:hover { background: rgba(18, 17, 22, .045); color: var(--ink); }
    nav a.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); border-color: var(--line); }
    nav svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; flex: none; opacity: .8; }
    .foot { margin-top: auto; padding-top: 16px; display: flex; flex-direction: column; gap: 10px; }
    .me { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; text-decoration: none; border: 1px solid var(--line); background: var(--surface); }
    .me:hover, .me.on-me { border-color: var(--ink-2); }
    .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand-deep); font-size: 12px; font-weight: 650; flex: none; }
    .me-text { display: flex; flex-direction: column; min-width: 0; }
    .me-text strong { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .me-text small { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .signout { align-self: flex-start; padding-left: 8px; color: var(--muted); }
    .main { min-width: 0; }
    .mobile-bar, .scrim { display: none; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .mobile-bar { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 12px; background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 30; }
      .burger { width: 40px; height: 40px; border: 0; background: none; display: grid; place-items: center; border-radius: 8px; cursor: pointer; color: var(--ink); }
      .mb-brand { display: inline-flex; }
      .side { position: fixed; z-index: 50; left: 0; top: 0; bottom: 0; width: 272px; transform: translateX(-100%); transition: transform .2s ease; box-shadow: var(--shadow-3); }
      .open .side { transform: none; }
      .open .scrim { display: block; position: fixed; inset: 0; z-index: 40; background: rgba(18, 17, 22, .4); }
    }
    @media print { .shell { display: block; } }
  `,
})
export class CandidateShell {
  protected auth = inject(AuthService);
  protected open = signal(false);

  constructor() {
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.open.set(false));
  }

  initials(): string {
    const n = this.auth.user()?.fullName ?? '';
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'Q';
  }
}
