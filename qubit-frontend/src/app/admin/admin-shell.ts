import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Logo } from '../shared/logo';
import { StaffAlerts } from '../core/staff-alerts.service';
import { IntegrityCaseRow } from '../core/models';
import { IstPipe } from '../core/format';
import { CaseDialog } from './case-dialog';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, IstPipe, CaseDialog],
  template: `
    <div class="shell">
      <aside class="side">
        <a routerLink="/admin" class="brand"><app-logo [size]="22" /><span class="tag mono">Admin</span></a>

        <nav aria-label="Admin">
          <p class="group">Assessments</p>
          <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">
            <svg viewBox="0 0 16 16"><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/></svg>Overview
          </a>
          <a routerLink="/admin/exams" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 11h5"/></svg>Exams
          </a>
          <a routerLink="/admin/live" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><path d="M4.5 4.5a5 5 0 0 0 0 7M11.5 4.5a5 5 0 0 1 0 7M2.5 2.5a8 8 0 0 0 0 11M13.5 2.5a8 8 0 0 1 0 11"/></svg>Live monitor
          </a>
          <p class="group">Learning</p>
          <a routerLink="/admin/courses" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M2 3.5h5a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 0 7 12.5H2zM14 3.5H9.5A1.5 1.5 0 0 0 8 5v9a1.5 1.5 0 0 1 1.5-1.5H14z"/></svg>Courses
          </a>
          <a routerLink="/admin/media" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="9" rx="1.5"/><path d="m6.5 5.8 3.5 1.7-3.5 1.7z"/><path d="M5 14h6"/></svg>Media library
          </a>

          <p class="group">Proctoring</p>
          <a routerLink="/admin/integrity" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M8 1.5 2.5 3.5v4c0 3.2 2.3 5.8 5.5 7 3.2-1.2 5.5-3.8 5.5-7v-4z"/><path d="M8 5v3.5M8 10.8v.2"/></svg>Integrity &amp; appeals
            @if (alerts.openCount() + alerts.pendingAppeals() > 0) {
              <span class="count mono" [class.hot]="alerts.openCount() > 0">{{ alerts.openCount() + alerts.pendingAppeals() }}</span>
            }
          </a>
          <a routerLink="/admin/lookup" routerLinkActive="on">
            <svg viewBox="0 0 16 16"><path d="M2 3v10M4.5 3v10M6 3v10M8.5 3v10M10 3v10M12 3v10M14 3v10"/></svg>Hall ticket lookup
          </a>

          @if (auth.isSuper()) {
            <p class="group">Superadmin</p>
            <a routerLink="/admin/users" routerLinkActive="on">
              <svg viewBox="0 0 16 16"><circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M11 3a2.5 2.5 0 0 1 0 5M12.5 10c1.3.5 2 2 2 4"/></svg>Users &amp; roles
            </a>
            <a routerLink="/admin/system" routerLinkActive="on">
              <svg viewBox="0 0 16 16"><path d="M2 3h12v8H2zM5.5 14h5M8 11v3"/><path d="m5 6 1.5 1.5L5 9M8 9h3"/></svg>System
            </a>
          }
        </nav>

        <div class="me">
          <div class="me-name">{{ auth.user()?.fullName }}</div>
          <div class="me-role mono">{{ roleLabel() }}</div>
          <div class="me-actions">
            <a routerLink="/app" class="link small">Candidate view</a>
            <button type="button" class="link small" (click)="auth.logout()">Sign out</button>
          </div>
        </div>
      </aside>

      <main class="main"><router-outlet /></main>
    </div>

    @if (alerts.open().length > 0) {
      <div class="alerts" role="region" aria-label="Integrity alerts" aria-live="assertive">
        @for (c of alerts.open().slice(0, 3); track c.id) {
          <div class="alert-card">
            <div class="ac-top">
              <span class="pulse"></span>
              <span class="mono ac-kind">Flagged · {{ c.openedAt | ist: 'time' }}</span>
              <span class="mono ac-count">{{ c.violationCount }}/{{ c.tolerance }}</span>
            </div>
            <div class="ac-who">{{ c.candidateName }}</div>
            <div class="ac-what">{{ c.reason }}</div>
            <div class="ac-exam small">{{ c.examTitle }} · <span class="mono">{{ c.hallTicketNo }}</span></div>
            <div class="ac-actions">
              <button class="btn btn-sm btn-ghost" type="button" (click)="alerts.dismiss(c, '')">Let continue</button>
              <button class="btn btn-sm btn-danger" type="button" (click)="review.set(c)">Review…</button>
            </div>
          </div>
        }
        @if (alerts.open().length > 3) {
          <a routerLink="/admin/integrity" class="more small">+{{ alerts.open().length - 3 }} more waiting</a>
        }
        @if (alerts.notifyPermission() === 'default') {
          <button type="button" class="link small enable" (click)="alerts.enableDesktop()">Turn on desktop notifications</button>
        }
      </div>
    }

    @if (review(); as c) { <app-case-dialog [case]="c" (closed)="review.set(null)" /> }
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 20px 14px; border-right: 1px solid var(--line); background: #faf9f5; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 2px 8px 22px; text-decoration: none; }
    .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--brand); border: 1px solid var(--brand-line); background: var(--brand-soft); padding: 2px 6px; border-radius: 4px; }
    nav { display: flex; flex-direction: column; gap: 1px; }
    .group { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--faint); padding: 14px 10px 6px; }
    nav a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; text-decoration: none; font-size: 14px; font-weight: 520; color: var(--ink-2); }
    nav a:hover { background: rgba(18, 17, 22, .045); color: var(--ink); }
    nav a.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); border: 1px solid var(--line); padding: 7px 9px; }
    nav svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; flex: none; opacity: .8; }
    .me { margin-top: auto; padding: 14px 10px 4px; border-top: 1px solid var(--line); }
    .me-name { font-weight: 600; font-size: 14px; }
    .me-role { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-top: 2px; }
    .me-actions { display: flex; gap: 14px; margin-top: 10px; }
    .main { min-width: 0; }
    nav a .count { margin-left: auto; font-size: 11px; min-width: 20px; text-align: center; padding: 1px 6px; border-radius: 999px; background: var(--line); color: var(--ink-2); }
    nav a .count.hot { background: var(--danger); color: #fff; }

    .alerts { position: fixed; right: 20px; bottom: 20px; z-index: 60; width: 330px; display: flex; flex-direction: column; gap: 10px; }
    .alert-card { background: var(--surface); border: 1px solid #efc4be; border-left: 3px solid var(--danger); border-radius: 10px; padding: 12px 14px; box-shadow: 0 10px 30px rgba(18,17,22,.14); animation: slide .22s ease-out; }
    @keyframes slide { from { transform: translateY(8px); opacity: 0; } }
    .ac-top { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--danger); text-transform: uppercase; letter-spacing: .06em; }
    .ac-count { margin-left: auto; color: var(--muted); }
    .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 0 rgba(200,50,40,.5); animation: pulse 1.6s infinite; }
    @keyframes pulse { 70% { box-shadow: 0 0 0 7px rgba(200,50,40,0); } 100% { box-shadow: 0 0 0 0 rgba(200,50,40,0); } }
    .ac-who { font-weight: 600; font-size: 15px; margin-top: 6px; }
    .ac-what { font-size: 13.5px; color: var(--ink-2); margin-top: 2px; }
    .ac-exam { color: var(--muted); margin-top: 4px; }
    .ac-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
    .more, .enable { align-self: flex-end; background: var(--surface); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); }
    @media (max-width: 560px) { .alerts { left: 16px; right: 16px; width: auto; bottom: 16px; } }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--line); }
      .brand { padding: 0 8px 0 0; }
      nav { flex-direction: row; overflow-x: auto; width: 100%; order: 3; }
      .group { display: none; }
      nav a { white-space: nowrap; }
      .me { margin: 0 0 0 auto; padding: 0; border: 0; }
      .me-name, .me-role { display: none; }
      .me-actions { margin: 0; }
    }
  `,
})
export class AdminShell implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  protected alerts = inject(StaffAlerts);
  protected review = signal<IntegrityCaseRow | null>(null);

  ngOnInit(): void { this.alerts.start(); }
  ngOnDestroy(): void { this.alerts.stop(); }

  roleLabel(): string {
    return this.auth.isSuper() ? 'Superadmin · developer' : 'Admin';
  }
}
