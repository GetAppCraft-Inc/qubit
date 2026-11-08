import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, wsUrl } from './api.service';
import { AuthService } from './auth.service';
import { errorMessage } from './format';
import { IntegrityCaseRow } from './models';
import { ToastService } from './toast.service';

interface CaseMessage {
  type: string;
  caseId?: number;
  caseStatus?: IntegrityCaseRow['status'];
  attemptId?: number;
  attemptStatus?: IntegrityCaseRow['attemptStatus'];
  examId?: number;
  examTitle?: string;
  candidateName?: string;
  candidateEmail?: string;
  hallTicketNo?: string;
  reason?: string;
  violationCount?: number;
  tolerance?: number;
  status?: string;
  at?: string;
}

/**
 * Invigilator alerts. Keeps one monitor socket open while staff are in the admin console:
 * open integrity cases arrive here instantly (with a desktop notification) and can be
 * decided from anywhere in the console.
 */
@Injectable({ providedIn: 'root' })
export class StaffAlerts {
  private api = inject(Api);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  /** Open cases, newest first. */
  readonly open = signal<IntegrityCaseRow[]>([]);
  readonly pendingAppeals = signal(0);
  readonly openCount = computed(() => this.open().length);
  readonly connected = signal(false);
  /** Bumped on any case/appeal change so pages can reload. */
  readonly version = signal(0);
  readonly notifyPermission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private users = 0;

  start(): void {
    if (this.users++ > 0) return;
    this.reload();
    this.connect();
  }

  stop(): void {
    if (--this.users > 0) return;
    this.users = 0;
    if (this.timer) clearTimeout(this.timer);
    if (this.ping) clearInterval(this.ping);
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000);
    this.connected.set(false);
  }

  reload(): void {
    this.api.integrityCases('OPEN').subscribe({ next: (c) => this.open.set(c), error: () => {} });
    this.api.integritySummary().subscribe({ next: (s) => this.pendingAppeals.set(s.pendingAppeals), error: () => {} });
  }

  async enableDesktop(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.notifyPermission.set(await Notification.requestPermission());
  }

  cancel(c: IntegrityCaseRow, note: string, done?: () => void): void {
    this.api.cancelCase(c.id, note).subscribe({
      next: () => {
        this.drop(c.id);
        this.toast.ok(`${c.candidateName}'s attempt was cancelled. They can appeal.`);
        done?.();
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.reload(); },
    });
  }

  dismiss(c: IntegrityCaseRow, note: string, done?: () => void): void {
    this.api.dismissCase(c.id, note).subscribe({
      next: () => {
        this.drop(c.id);
        this.toast.ok(`${c.candidateName} can continue.`);
        done?.();
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.reload(); },
    });
  }

  caseFor(attemptId: number): IntegrityCaseRow | undefined {
    return this.open().find((c) => c.attemptId === attemptId);
  }

  private drop(caseId: number): void {
    this.open.update((l) => l.filter((x) => x.id !== caseId));
    this.version.update((v) => v + 1);
  }

  private connect(): void {
    const token = this.auth.token();
    if (!token || this.users === 0) return;
    const ws = new WebSocket(wsUrl('/ws/monitor', { token }));
    this.ws = ws;
    ws.onopen = () => {
      this.connected.set(true);
      if (this.retry > 0) this.reload();
      this.retry = 0;
      if (this.ping) clearInterval(this.ping);
      this.ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"PING"}'), 25000);
    };
    ws.onmessage = (ev) => {
      try { this.handle(JSON.parse(ev.data)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      this.connected.set(false);
      if (this.ws !== ws) return;
      this.timer = setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.retry++));
    };
  }

  private handle(m: CaseMessage): void {
    switch (m.type) {
      case 'CASE_OPENED':
      case 'CASE_UPDATED': {
        if (!m.caseId) return;
        const row = this.toRow(m);
        if (row.status === 'OPEN') {
          this.open.update((l) => [row, ...l.filter((x) => x.id !== row.id)]);
        }
        this.version.update((v) => v + 1);
        if (m.type === 'CASE_OPENED') {
          const auto = row.status === 'AUTO_TERMINATED';
          const title = auto ? 'Attempt auto-terminated' : 'Candidate flagged — decision needed';
          const body = `${row.candidateName} · ${row.examTitle}\n${row.reason}`;
          this.desktop(title, body, `case-${row.id}`);
          if (auto) this.toast.info(`${row.candidateName}'s attempt was terminated automatically.`);
          this.chime();
        }
        break;
      }
      case 'CASE_DECIDED':
        if (m.caseId) this.drop(m.caseId);
        break;
      case 'APPEAL_SUBMITTED':
        this.pendingAppeals.update((n) => n + 1);
        this.version.update((v) => v + 1);
        this.desktop('New appeal', `${m.candidateName} · ${m.examTitle}`, `appeal-${m.attemptId}`);
        this.toast.info(`${m.candidateName ?? 'A candidate'} appealed a cancelled attempt.`);
        break;
      case 'APPEAL_DECIDED':
        this.pendingAppeals.update((n) => Math.max(0, n - 1));
        this.version.update((v) => v + 1);
        break;
      case 'ATTEMPT_ENDED':
        // Status of an open case's attempt changed (submitted/timed out) — keep the card accurate.
        if (m.attemptId) {
          this.open.update((l) => l.map((x) => x.attemptId === m.attemptId
            ? { ...x, attemptStatus: (m.status as IntegrityCaseRow['attemptStatus']) ?? x.attemptStatus } : x));
        }
        break;
    }
  }

  private toRow(m: CaseMessage): IntegrityCaseRow {
    return {
      id: m.caseId!, status: m.caseStatus ?? 'OPEN', reason: m.reason ?? 'Integrity violation',
      violationCount: m.violationCount ?? 0, tolerance: m.tolerance ?? 0, openedAt: m.at ?? new Date().toISOString(),
      updatedAt: m.at, attemptId: m.attemptId ?? 0, attemptStatus: m.attemptStatus ?? 'IN_PROGRESS', online: true,
      examId: m.examId ?? 0, examTitle: m.examTitle ?? '', examCode: '', candidateName: m.candidateName ?? 'Candidate',
      candidateEmail: m.candidateEmail ?? '', hallTicketNo: m.hallTicketNo ?? '',
    };
  }

  private desktop(title: string, body: string, tag: string): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag, requireInteraction: true, icon: '/favicon.ico' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* some browsers only allow notifications from a service worker */ }
  }

  private chime(): void {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
      o.onended = () => ctx.close();
    } catch { /* audio blocked until the user interacts */ }
  }
}
