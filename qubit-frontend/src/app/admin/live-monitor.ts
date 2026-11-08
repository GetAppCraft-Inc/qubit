import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Api, wsUrl } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { clock, errorMessage, IstPipe } from '../core/format';
import { LiveAttempt, ProctorEventRow } from '../core/models';
import { ToastService } from '../core/toast.service';
import { nowSignal } from '../shared/status';
import { StaffAlerts } from '../core/staff-alerts.service';
import { CaseDialog } from './case-dialog';
import { IntegrityCaseRow } from '../core/models';

interface MonitorMessage {
  type: 'HELLO' | 'PONG' | 'ATTEMPT_STARTED' | 'ATTEMPT_ENDED' | 'VIOLATION' | 'PRESENCE';
  attemptId?: number;
  examId?: number;
  examTitle?: string;
  candidateName?: string;
  candidateEmail?: string;
  hallTicketNo?: string;
  violationCount?: number;
  tolerance?: number;
  startedAt?: string;
  endsAt?: string;
  at?: string;
  violation?: string;
  label?: string;
  counted?: boolean;
  detail?: string;
  status?: string;
  reason?: string;
  online?: boolean;
}

interface FeedItem { id: number; at: string; tone: 'info' | 'warn' | 'danger' | 'ok' | 'muted'; who: string; ticket?: string; what: string; }

@Component({
  selector: 'app-live-monitor',
  imports: [IstPipe, CaseDialog],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div>
          <h1>Live monitor</h1>
          <p>Every attempt in progress, updated as it happens. Flags arrive here the moment the candidate's window reports them.</p>
        </div>
        <span class="conn mono" [class.ok]="connected()">
          <i class="dot" [class.dot-live]="connected()"></i>{{ connected() ? 'Live' : 'Connecting…' }}
        </span>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      <div class="layout">
        <section class="card">
          <div class="card-head">
            <h3>In progress <span class="muted mono">{{ rows().length }}</span></h3>
            @if (flagged() > 0) { <span class="badge badge-warn">{{ flagged() }} flagged</span> }
          </div>
          @if (rows().length === 0) {
            <div class="empty">
              <h3>No one is sitting a paper right now</h3>
              <p>When a candidate begins, they'll appear here instantly.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Candidate</th><th>Exam</th><th>Time left</th><th class="num">Warnings</th><th></th></tr></thead>
                <tbody>
                  @for (r of rows(); track r.attemptId) {
                    @let fc = alerts.caseFor(r.attemptId);
                    <tr [class.hot]="r.violationCount > 0" [class.flag]="!!fc">
                      <td>
                        <div class="who"><i class="dot" [class.dot-live]="r.online" [class.off]="!r.online" [title]="r.online ? 'Connected' : 'Offline'"></i>{{ r.candidateName }}</div>
                        <div class="muted small mono">{{ r.hallTicketNo }}</div>
                        @if (fc) { <div class="flagnote small">Flagged — awaiting your decision</div> }
                      </td>
                      <td class="small">{{ r.examTitle }}</td>
                      <td class="mono">{{ left(r) }}</td>
                      <td class="num mono" [class.warn]="r.violationCount > 0">{{ r.violationCount }} / {{ r.tolerance }}</td>
                      <td class="act">
                        <button class="btn btn-quiet btn-sm" type="button" (click)="openLog(r)">Log</button>
                        @if (fc) {
                          <button class="btn btn-ghost btn-sm" type="button" (click)="alerts.dismiss(fc, '')">Let continue</button>
                          <button class="btn btn-danger btn-sm" type="button" (click)="review.set(fc)">Decide…</button>
                        } @else {
                          <button class="btn btn-danger-ghost btn-sm" type="button" (click)="askTerminate(r)">End</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <aside class="feed">
          <div class="feed-head mono"><span>Event stream</span><span>{{ feed().length }}</span></div>
          <ul>
            @for (f of feed(); track f.id) {
              <li [class]="f.tone">
                <span class="t mono">{{ f.at | ist: 'timeSec' }}</span>
                <span class="body"><strong>{{ f.who }}</strong> {{ f.what }}</span>
              </li>
            } @empty {
              <li class="muted"><span class="body">Waiting for activity…</span></li>
            }
          </ul>
        </aside>
      </div>
    </div>

    @if (logFor(); as r) {
      <div class="backdrop" (click)="logFor.set(null)">
        <div class="dialog log" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h3>{{ r.candidateName }}</h3>
          <p class="muted small mono">{{ r.hallTicketNo }} · {{ r.examTitle }} · started {{ r.startedAt | ist: 'time' }}</p>
          <ul class="events">
            @for (e of events(); track e.id) {
              <li [class.counted]="e.counted">
                <span class="mono t">{{ e.at | ist: 'timeSec' }}</span>
                <span>{{ e.label }}@if (e.detail) { <span class="muted"> — {{ e.detail }}</span> }</span>
                @if (e.counted) { <span class="badge badge-warn">counted</span> }
              </li>
            } @empty {
              <li class="muted">No events recorded.</li>
            }
          </ul>
          <div class="dialog-actions"><button class="btn btn-ghost" type="button" (click)="logFor.set(null)">Close</button></div>
        </div>
      </div>
    }

    @if (review(); as c) { <app-case-dialog [case]="c" (closed)="review.set(null)" /> }

    @if (terminateFor(); as r) {
      <div class="backdrop">
        <div class="dialog" role="dialog" aria-modal="true">
          <h3>End {{ r.candidateName }}'s attempt?</h3>
          <p>Their paper closes immediately and is recorded as cancelled. They are emailed and can appeal for a retake.</p>
          <div class="field" style="margin-top: 14px">
            <label for="why">Reason (shown to the candidate)</label>
            <input id="why" class="input" [value]="reason()" (input)="reason.set($any($event.target).value)" placeholder="Phone visible on camera" />
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" type="button" (click)="terminateFor.set(null)">Cancel</button>
            <button class="btn btn-danger" type="button" (click)="terminate()">End attempt</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .wide { max-width: 1320px; }
    .conn { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
    .conn.ok { color: var(--ok); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; align-items: start; }
    .card-head h3 span { font-weight: 400; margin-left: 6px; }
    .who { display: flex; align-items: center; gap: 8px; font-weight: 550; }
    .dot.off { background: var(--line-strong); }
    tr.hot td { background: #fffaf2; }
    tr.flag td { background: #fff4f2; }
    tr.flag td:first-child { box-shadow: inset 3px 0 0 var(--danger); }
    .flagnote { color: var(--danger); font-weight: 550; margin-top: 3px; }
    .warn { color: var(--warn); font-weight: 600; }
    .act { text-align: right; white-space: nowrap; }
    .act .btn + .btn { margin-left: 4px; }

    .feed { background: #121116; border-radius: var(--radius); overflow: hidden; color: #d2d0d9; position: sticky; top: 20px; }
    .feed-head { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8d8a97; border-bottom: 1px solid #22212a; }
    .feed ul { list-style: none; margin: 0; padding: 6px 0; max-height: 68vh; overflow-y: auto; }
    .feed li { display: grid; grid-template-columns: 64px 1fr; gap: 10px; padding: 8px 16px; font-size: 13px; line-height: 1.4; border-left: 2px solid transparent; }
    .feed li .t { color: #6e6b78; font-size: 11.5px; padding-top: 1px; }
    .feed li strong { color: #fff; font-weight: 550; }
    .feed li.warn { border-left-color: #f0b65a; }
    .feed li.warn .body { color: #f0d3a1; }
    .feed li.danger { border-left-color: #ff8a7c; }
    .feed li.danger .body { color: #ffb3aa; }
    .feed li.ok { border-left-color: #4fd18b; }
    .feed li.muted .body { color: #8d8a97; }

    .dialog.log { width: min(600px, 100%); }
    .events { list-style: none; padding: 0; margin: 16px 0 0; max-height: 50vh; overflow-y: auto; border-top: 1px solid var(--line); }
    .events li { display: flex; gap: 12px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
    .events .t { font-size: 12px; color: var(--muted); flex: none; }
    .events .badge { margin-left: auto; }
    .events li.counted span:nth-child(2) { color: var(--warn); font-weight: 550; }

    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .feed { position: static; } }
  `,
})
export class LiveMonitor implements OnInit, OnDestroy {
  private api = inject(Api);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  protected now = nowSignal();
  protected alerts = inject(StaffAlerts);
  protected review = signal<IntegrityCaseRow | null>(null);

  protected rows = signal<LiveAttempt[]>([]);
  protected feed = signal<FeedItem[]>([]);
  protected connected = signal(false);
  protected error = signal<string | null>(null);
  protected logFor = signal<LiveAttempt | null>(null);
  protected events = signal<ProctorEventRow[]>([]);
  protected terminateFor = signal<LiveAttempt | null>(null);
  protected reason = signal('');

  protected flagged = computed(() => this.rows().filter((r) => r.violationCount > 0).length);

  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private closed = false;

  ngOnInit(): void {
    this.refresh();
    this.connect();
  }

  ngOnDestroy(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.ping) clearInterval(this.ping);
    this.ws?.close(1000);
  }

  private refresh(): void {
    this.api.liveAttempts().subscribe({
      next: (r) => this.rows.set(r),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  private connect(): void {
    const token = this.auth.token();
    if (!token || this.closed) return;
    const ws = new WebSocket(wsUrl('/ws/monitor', { token }));
    this.ws = ws;
    ws.onopen = () => {
      this.connected.set(true);
      if (this.retry > 0) this.refresh();
      this.retry = 0;
      if (this.ping) clearInterval(this.ping);
      this.ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"PING"}'), 25000);
    };
    ws.onmessage = (ev) => {
      try { this.handle(JSON.parse(ev.data)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      this.connected.set(false);
      if (this.closed || this.ws !== ws) return;
      this.timer = setTimeout(() => this.connect(), Math.min(10000, 1000 * 2 ** this.retry++));
    };
  }

  private handle(m: MonitorMessage): void {
    const id = m.attemptId;
    if (!id) return;
    const who = m.candidateName ?? 'Candidate';
    switch (m.type) {
      case 'ATTEMPT_STARTED':
        this.rows.update((list) => list.some((r) => r.attemptId === id) ? list : [{
          attemptId: id, examId: m.examId ?? 0, examTitle: m.examTitle ?? '', candidateName: who, candidateEmail: m.candidateEmail ?? '',
          hallTicketNo: m.hallTicketNo ?? '', startedAt: m.startedAt ?? new Date().toISOString(), endsAt: m.endsAt ?? new Date().toISOString(),
          violationCount: m.violationCount ?? 0, tolerance: m.tolerance ?? 0, online: false,
        }, ...list]);
        this.push(m, 'info', 'started ' + (m.examTitle ?? 'an exam'));
        break;
      case 'ATTEMPT_ENDED':
        this.rows.update((list) => list.filter((r) => r.attemptId !== id));
        if (m.status === 'TERMINATED') this.push(m, 'danger', `was cancelled — ${m.reason ?? ''}`);
        else this.push(m, 'ok', m.status === 'AUTO_SUBMITTED' ? 'ran out of time (auto-submitted)' : 'submitted');
        break;
      case 'VIOLATION':
        this.patch(id, { violationCount: m.violationCount ?? 0 });
        this.push(m, m.counted ? 'warn' : 'muted', `${(m.label ?? m.violation ?? '').toLowerCase()}${m.counted ? ` (${m.violationCount}/${m.tolerance})` : ''}`);
        break;
      case 'PRESENCE':
        this.patch(id, { online: !!m.online });
        this.push(m, m.online ? 'muted' : 'warn', m.online ? 'reconnected' : 'went offline');
        break;
    }
  }

  private patch(id: number, p: Partial<LiveAttempt>): void {
    this.rows.update((list) => list.map((r) => (r.attemptId === id ? { ...r, ...p } : r)));
  }

  private push(m: MonitorMessage, tone: FeedItem['tone'], what: string): void {
    const item: FeedItem = { id: ++this.seq, at: m.at ?? new Date().toISOString(), tone, who: m.candidateName ?? 'Candidate', ticket: m.hallTicketNo, what };
    this.feed.update((f) => [item, ...f].slice(0, 150));
  }

  left(r: LiveAttempt): string {
    return clock(Date.parse(r.endsAt) - this.now());
  }

  openLog(r: LiveAttempt): void {
    this.logFor.set(r);
    this.events.set([]);
    this.api.attemptEvents(r.attemptId).subscribe({ next: (e) => this.events.set(e.slice().reverse()) });
  }

  askTerminate(r: LiveAttempt): void {
    this.reason.set('');
    this.terminateFor.set(r);
  }

  terminate(): void {
    const r = this.terminateFor();
    if (!r) return;
    this.terminateFor.set(null);
    this.api.terminateAttempt(r.attemptId, this.reason().trim()).subscribe({
      next: () => this.toast.ok(`${r.candidateName}'s attempt was ended.`),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
