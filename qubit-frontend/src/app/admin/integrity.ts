import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { AppealRow, IntegrityCaseRow, ProctorEventRow } from '../core/models';
import { StaffAlerts } from '../core/staff-alerts.service';
import { ToastService } from '../core/toast.service';
import { CaseDialog } from './case-dialog';

type Tab = 'open' | 'appeals' | 'history';

@Component({
  selector: 'app-integrity',
  imports: [IstPipe, CaseDialog, RouterLink],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div>
          <h1>Integrity &amp; appeals</h1>
          <p>Flagged attempts wait here for a decision. Cancelled candidates can appeal once; approving gives them a fresh attempt.</p>
        </div>
        <span class="conn mono" [class.ok]="alerts.connected()"><i class="dot" [class.dot-live]="alerts.connected()"></i>{{ alerts.connected() ? 'Live' : 'Connecting…' }}</span>
      </div>

      <div class="tabs" role="tablist">
        <button class="tab" role="tab" [class.active]="tab() === 'open'" (click)="tab.set('open')">Needs decision<span class="count">{{ alerts.openCount() }}</span></button>
        <button class="tab" role="tab" [class.active]="tab() === 'appeals'" (click)="tab.set('appeals')">Appeals<span class="count">{{ alerts.pendingAppeals() }} pending</span></button>
        <button class="tab" role="tab" [class.active]="tab() === 'history'" (click)="tab.set('history')">History</button>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @switch (tab()) {
        @case ('open') {
          @if (alerts.open().length === 0) {
            <div class="card empty">
              <h3>Nothing waiting</h3>
              <p>When a candidate goes past an exam's warning limit, they're flagged here and you'll get an alert anywhere in the console.</p>
              @if (alerts.notifyPermission() === 'default') {
                <button class="btn btn-ghost" style="margin-top:16px" type="button" (click)="alerts.enableDesktop()">Turn on desktop notifications</button>
              }
            </div>
          } @else {
            <div class="cases">
              @for (c of alerts.open(); track c.id) {
                <article class="card case">
                  <header>
                    <div>
                      <h3>{{ c.candidateName }}</h3>
                      <p class="muted small mono">{{ c.hallTicketNo }} · {{ c.examTitle }}</p>
                    </div>
                    <span class="badge" [class.badge-warn]="c.attemptStatus === 'IN_PROGRESS'">{{ c.attemptStatus === 'IN_PROGRESS' ? 'Still writing' : 'Submitted' }}</span>
                  </header>
                  <p class="reason">{{ c.reason }}</p>
                  <p class="meta mono small">{{ c.violationCount }} warnings · limit {{ c.tolerance }} · flagged {{ c.openedAt | ist: 'timeSec' }}</p>
                  <div class="row-actions">
                    <button class="btn btn-quiet btn-sm" type="button" (click)="openLog(c.attemptId, c.candidateName)">Event log</button>
                    <span class="grow"></span>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="alerts.dismiss(c, '')">Let continue</button>
                    <button class="btn btn-danger btn-sm" type="button" (click)="review.set(c)">Cancel attempt…</button>
                  </div>
                </article>
              }
            </div>
          }
        }

        @case ('appeals') {
          @if (appeals().length === 0) {
            <div class="card empty"><h3>No appeals yet</h3><p>Candidates whose attempt was cancelled can explain what happened from their registrations page.</p></div>
          } @else {
            <div class="appeals">
              @for (a of appeals(); track a.id) {
                <article class="card appeal" [class.decided]="a.status !== 'PENDING'">
                  <header>
                    <div>
                      <h3>{{ a.candidateName }}</h3>
                      <p class="muted small mono">{{ a.hallTicketNo }} · {{ a.examTitle }} · {{ a.createdAt | ist }}</p>
                    </div>
                    <span class="badge" [class.badge-warn]="a.status === 'PENDING'" [class.badge-ok]="a.status === 'APPROVED'" [class.badge-danger]="a.status === 'REJECTED'">{{ statusLabel(a.status) }}</span>
                  </header>
                  <div class="why">
                    <span class="lbl mono">Cancelled for</span>
                    <span>{{ a.terminationReason ?? '—' }} <span class="muted mono small">({{ a.violationCount }} warnings)</span></span>
                  </div>
                  <blockquote>{{ a.message }}</blockquote>

                  @if (a.status === 'PENDING') {
                    <div class="decide">
                      <input class="input" [value]="notes()[a.id] ?? ''" (input)="setNote(a.id, $any($event.target).value)" placeholder="Note to the candidate (optional)" maxlength="1000" />
                      <label class="hours small">Retake within
                        <select class="input" [value]="hours()[a.id] ?? 48" (change)="setHours(a.id, +$any($event.target).value)">
                          <option [value]="6">6 hours</option><option [value]="24">24 hours</option><option [value]="48">2 days</option>
                          <option [value]="72">3 days</option><option [value]="168">7 days</option>
                        </select>
                      </label>
                    </div>
                    <div class="row-actions">
                      <button class="btn btn-quiet btn-sm" type="button" (click)="openLog(a.attemptId, a.candidateName)">Event log</button>
                      <span class="grow"></span>
                      <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy() === a.id" (click)="reject(a)">Reject</button>
                      <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() === a.id" (click)="approve(a)">Approve retake</button>
                    </div>
                  } @else {
                    <p class="outcome small">
                      {{ a.status === 'APPROVED' ? 'Approved' : 'Rejected' }} by {{ a.decidedBy ?? 'staff' }} · {{ a.decidedAt | ist }}
                      @if (a.retakeUntil) { · retake open until {{ a.retakeUntil | ist }} }
                      @if (a.decisionNote) { <br><span class="muted">“{{ a.decisionNote }}”</span> }
                    </p>
                  }
                </article>
              }
            </div>
          }
        }

        @case ('history') {
          <section class="card">
            @if (history().length === 0) {
              <div class="empty"><h3>No cases yet</h3></div>
            } @else {
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Candidate</th><th>Exam</th><th>Flag</th><th>Outcome</th><th>Decided</th></tr></thead>
                  <tbody>
                    @for (c of history(); track c.id) {
                      <tr>
                        <td><div class="strong">{{ c.candidateName }}</div><div class="muted small mono">{{ c.hallTicketNo }}</div></td>
                        <td class="small"><a class="link" [routerLink]="['/admin/exams', c.examId]">{{ c.examTitle }}</a></td>
                        <td class="small">{{ c.reason }}<div class="muted mono">{{ c.violationCount }}/{{ c.tolerance }} · {{ c.openedAt | ist: 'dateShort' }}</div></td>
                        <td><span class="badge" [class]="caseBadge(c.status)">{{ caseLabel(c.status) }}</span></td>
                        <td class="small">{{ c.decidedBy ?? (c.status === 'AUTO_TERMINATED' ? 'Automatic' : '—') }}<div class="muted">{{ c.decisionNote }}</div></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      }
    </div>

    @if (review(); as c) { <app-case-dialog [case]="c" (closed)="review.set(null)" /> }

    @if (logName()) {
      <div class="backdrop" (click)="logName.set(null)">
        <div class="dialog log" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h3>{{ logName() }}</h3>
          <ul class="events">
            @for (e of events(); track e.id) {
              <li [class.counted]="e.counted">
                <span class="mono t">{{ e.at | ist: 'timeSec' }}</span>
                <span>{{ e.label }}@if (e.detail) { <span class="muted"> — {{ e.detail }}</span> }</span>
                @if (e.counted) { <span class="badge badge-warn">counted</span> }
              </li>
            } @empty { <li class="muted">No events recorded.</li> }
          </ul>
          <div class="dialog-actions"><button class="btn btn-ghost" type="button" (click)="logName.set(null)">Close</button></div>
        </div>
      </div>
    }
  `,
  styles: `
    .wide { max-width: 1180px; }
    .conn { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
    .conn.ok { color: var(--ok); }
    .cases, .appeals { display: grid; gap: 14px; }
    .cases { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
    .case { border-left: 3px solid var(--danger); padding: 16px 18px; }
    .appeal { padding: 18px 20px; }
    .appeal.decided { opacity: .85; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    header h3 { margin: 0; font-size: 16px; }
    header p { margin: 2px 0 0; }
    .reason { margin: 12px 0 4px; font-weight: 550; }
    .meta { color: var(--muted); margin: 0; }
    .row-actions { display: flex; gap: 6px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
    .grow { flex: 1; }
    .why { display: flex; gap: 10px; margin-top: 14px; font-size: 14px; flex-wrap: wrap; }
    .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding-top: 2px; }
    blockquote { margin: 12px 0 0; padding: 12px 14px; border-left: 2px solid var(--line-strong); background: var(--bg, #faf9f5); border-radius: 0 8px 8px 0; white-space: pre-wrap; font-size: 14.5px; line-height: 1.55; }
    .decide { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .decide > .input { flex: 1 1 260px; }
    .hours { display: flex; align-items: center; gap: 8px; color: var(--muted); white-space: nowrap; }
    .hours select { width: auto; }
    .outcome { margin: 14px 0 0; color: var(--ink-2); }
    .strong { font-weight: 550; }
    .dialog.log { width: min(600px, 100%); }
    .events { list-style: none; padding: 0; margin: 16px 0 0; max-height: 50vh; overflow-y: auto; border-top: 1px solid var(--line); }
    .events li { display: flex; gap: 12px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
    .events .t { font-size: 12px; color: var(--muted); flex: none; }
    .events .badge { margin-left: auto; }
    @media (max-width: 560px) { .cases { grid-template-columns: 1fr; } }
  `,
})
export class IntegrityPage {
  private api = inject(Api);
  private toast = inject(ToastService);
  protected alerts = inject(StaffAlerts);

  protected tab = signal<Tab>('open');
  protected appeals = signal<AppealRow[]>([]);
  protected history = signal<IntegrityCaseRow[]>([]);
  protected review = signal<IntegrityCaseRow | null>(null);
  protected error = signal<string | null>(null);
  protected notes = signal<Partial<Record<number, string>>>({});
  protected hours = signal<Partial<Record<number, number>>>({});
  protected busy = signal<number | null>(null);
  protected logName = signal<string | null>(null);
  protected events = signal<ProctorEventRow[]>([]);

  constructor() {
    effect(() => {
      this.alerts.version();
      const t = this.tab();
      untracked(() => this.load(t));
    });
  }

  private load(t: Tab): void {
    if (t === 'open') this.alerts.reload();
    if (t === 'appeals') this.api.appeals().subscribe({ next: (a) => this.appeals.set(a), error: (e) => this.error.set(errorMessage(e)) });
    if (t === 'history') this.api.integrityCases('ALL').subscribe({ next: (c) => this.history.set(c), error: (e) => this.error.set(errorMessage(e)) });
  }

  setNote(id: number, v: string): void { this.notes.update((n) => ({ ...n, [id]: v })); }
  setHours(id: number, v: number): void { this.hours.update((n) => ({ ...n, [id]: v })); }

  approve(a: AppealRow): void {
    this.busy.set(a.id);
    this.api.approveAppeal(a.id, (this.notes()[a.id] ?? '').trim(), this.hours()[a.id] ?? 48).subscribe({
      next: (r) => { this.busy.set(null); this.replace(r); this.toast.ok(`${a.candidateName} can retake the exam. They've been emailed.`); },
      error: (e) => { this.busy.set(null); this.toast.error(errorMessage(e)); },
    });
  }

  reject(a: AppealRow): void {
    this.busy.set(a.id);
    this.api.rejectAppeal(a.id, (this.notes()[a.id] ?? '').trim()).subscribe({
      next: (r) => { this.busy.set(null); this.replace(r); this.toast.ok('Appeal rejected. The candidate has been emailed.'); },
      error: (e) => { this.busy.set(null); this.toast.error(errorMessage(e)); },
    });
  }

  private replace(r: AppealRow): void {
    this.appeals.update((l) => l.map((x) => (x.id === r.id ? r : x)));
  }

  openLog(attemptId: number, name: string): void {
    this.logName.set(name);
    this.events.set([]);
    this.api.attemptEvents(attemptId).subscribe({ next: (e) => this.events.set(e.slice().reverse()) });
  }

  statusLabel(s: string): string {
    return s === 'PENDING' ? 'Awaiting decision' : s === 'APPROVED' ? 'Retake approved' : 'Rejected';
  }

  caseLabel(s: string): string {
    return ({ OPEN: 'Open', DISMISSED: 'Allowed to continue', CANCELLED: 'Cancelled', AUTO_TERMINATED: 'Auto-terminated' } as Record<string, string>)[s] ?? s;
  }

  caseBadge(s: string): string {
    return 'badge ' + (s === 'DISMISSED' ? 'badge-ok' : s === 'OPEN' ? 'badge-warn' : 'badge-danger');
  }
}
