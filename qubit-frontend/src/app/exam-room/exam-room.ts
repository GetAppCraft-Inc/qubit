import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, wsUrl } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { clock, DurationPipe, errorCode, errorMessage, IstPipe, optionLetter, until } from '../core/format';
import { AttemptStatus, Paper, PaperQuestion, Registration, ViolationOutcome } from '../core/models';
import { Logo } from '../shared/logo';
import { MathText } from '../shared/math-text';
import { AppealBox } from '../shared/appeal-box';

type Phase = 'loading' | 'lobby' | 'starting' | 'running' | 'ended' | 'error';
type EndKind = AttemptStatus | 'SUPERSEDED';
type CellState = 'fresh' | 'skipped' | 'answered' | 'review' | 'answered-review';

interface LocalAnswer { response: string | null; marked: boolean; }

interface ServerMessage {
  type: 'HELLO' | 'PONG' | 'WARNING' | 'ENDED' | 'REJECTED' | 'REVIEW_CLEARED';
  flagged?: boolean;
  serverNow?: string;
  endsAt?: string;
  violationCount?: number;
  tolerance?: number;
  counted?: boolean;
  label?: string;
  status?: AttemptStatus;
  reason?: string;
  code?: string;
  message?: string;
}

/** Keys that are always blocked inside the exam (combined with Ctrl / ⌘ / Alt, or function keys). */
const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

@Component({
  selector: 'app-exam-room',
  imports: [RouterLink, NgTemplateOutlet, IstPipe, DurationPipe, Logo, MathText, AppealBox],
  templateUrl: './exam-room.html',
  styleUrl: './exam-room.scss',
})
export class ExamRoom implements OnInit, OnDestroy {
  private api = inject(Api);
  private auth = inject(AuthService);
  private router = inject(Router);

  registrationId = input.required<string>();

  // ---------------------------------------------------------------- state
  protected phase = signal<Phase>('loading');
  protected reg = signal<Registration | null>(null);
  protected paper = signal<Paper | null>(null);
  protected error = signal<string | null>(null);
  protected agree = signal(false);
  protected now = signal(Date.now());
  private offset = signal(0); // serverTime - clientTime

  protected answers = signal<Record<number, LocalAnswer>>({});
  protected visited = signal<ReadonlySet<number>>(new Set());
  protected current = signal(0);
  protected numericDraft = signal('');

  protected violationCount = signal(0);
  protected wsState = signal<'connecting' | 'live' | 'reconnecting'>('connecting');
  protected isFullscreen = signal(false);
  protected warning = signal<{ label: string; count: number; tolerance: number; flagged?: boolean } | null>(null);
  /** Over the limit and waiting for an invigilator (review mode). */
  protected underReview = signal(false);
  protected notice = signal<string | null>(null);
  protected confirmOpen = signal(false);
  protected ended = signal<{ kind: EndKind; reason?: string } | null>(null);
  protected saving = signal(0);
  protected savedAt = signal<number | null>(null);
  protected saveFailed = signal(false);
  protected submitting = signal(false);

  // ---------------------------------------------------------------- derived
  protected questions = computed(() => this.paper()?.questions ?? []);
  protected q = computed<PaperQuestion | undefined>(() => this.questions()[this.current()]);
  protected subjects = computed(() => [...new Set(this.questions().map((x) => x.subject))]);
  protected subjectQuestions = computed(() => {
    const s = this.q()?.subject;
    return this.questions().filter((x) => x.subject === s);
  });
  /** Open (low-stakes) quizzes skip full screen and integrity guards. */
  protected isOpen = computed(() => (this.paper()?.mode ?? this.reg()?.exam.mode) === 'OPEN');
  protected tolerance = computed(() => this.paper()?.violationTolerance ?? this.reg()?.exam.violationTolerance ?? 0);

  protected remainingMs = computed(() => {
    const p = this.paper();
    return p ? Date.parse(p.endsAt) - (this.now() + this.offset()) : 0;
  });
  protected timerText = computed(() => clock(this.remainingMs()));
  protected timerTone = computed(() => {
    const m = this.remainingMs() / 60000;
    return m <= 5 ? 'crit' : m <= 15 ? 'warn' : '';
  });

  protected counts = computed(() => {
    const a = this.answers();
    const v = this.visited();
    let answered = 0, review = 0, skipped = 0, fresh = 0;
    for (const q of this.questions()) {
      const st = this.cellState(q.id, a, v);
      if (st === 'answered' || st === 'answered-review') answered++;
      if (st === 'review' || st === 'answered-review') review++;
      if (st === 'skipped') skipped++;
      if (st === 'fresh') fresh++;
    }
    return { answered, review, skipped, fresh, total: this.questions().length };
  });

  protected subjectProgress = computed(() => {
    const a = this.answers();
    return this.subjects().map((s) => {
      const qs = this.questions().filter((q) => q.subject === s);
      return { subject: s, total: qs.length, answered: qs.filter((q) => !!a[q.id]?.response).length, first: this.questions().indexOf(qs[0]) };
    });
  });

  protected entry = computed(() => {
    const r = this.reg();
    if (!r) return { state: 'unknown' as const, label: '' };
    const now = this.now();
    if (r.attempt?.status === 'IN_PROGRESS') return { state: 'resume' as const, label: '' };
    if (now < Date.parse(r.entryOpensAt)) return { state: 'early' as const, label: until(Date.parse(r.entryOpensAt) - now) };
    if (now > Date.parse(r.entryClosesAt)) return { state: 'closed' as const, label: '' };
    return { state: 'open' as const, label: until(Date.parse(r.entryClosesAt) - now) };
  });

  protected checks = computed(() => {
    this.now(); // re-evaluate every tick
    const extended = (screen as Screen & { isExtended?: boolean }).isExtended;
    const devtools = window.outerWidth - window.innerWidth > 160;
    return {
      fullscreen: !!document.fullscreenEnabled,
      singleScreen: extended === undefined ? 'unknown' : !extended,
      devtools: !devtools,
      online: navigator.onLine,
    };
  });

  protected canStart = computed(() => {
    const c = this.checks();
    const e = this.entry().state;
    const windowOk = e === 'open' || e === 'resume';
    if (this.isOpen()) return c.online && windowOk;
    return this.agree() && c.fullscreen && c.singleScreen !== false && c.online && windowOk;
  });

  protected watermark = computed(() => {
    const p = this.paper();
    if (!p) return 'none';
    const text = `${p.hallTicketNo}  ·  ${this.auth.user()?.email ?? p.candidateName}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='10' y='130' transform='rotate(-22 210 110)' font-family='monospace' font-size='12' fill='rgba(18,17,22,0.05)'>${text}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  });

  // ---------------------------------------------------------------- internals
  private ws: WebSocket | null = null;
  private wsRetry = 0;
  private wsTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer = setInterval(() => this.now.set(Date.now()), 250);
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private guards: AbortController | null = null;
  private armed = false;
  private autoSubmitted = false;
  private lastSent: Record<string, number> = {};
  private dirty = new Set<number>();
  private chains: Record<number, Promise<void>> = {};
  private numericTimer: ReturnType<typeof setTimeout> | null = null;
  private devtoolsFlagged = false;

  protected readonly letter = optionLetter;

  private get sidKey(): string { return `qubit.sid.${this.registrationId()}`; }

  // ---------------------------------------------------------------- lifecycle

  ngOnInit(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', this.onFullscreenChangePassive);
    this.api.registration(+this.registrationId()).subscribe({
      next: (r) => {
        this.reg.set(r);
        const s = r.attempt?.status;
        if (s && s !== 'IN_PROGRESS') {
          this.ended.set({ kind: s, reason: r.attempt?.terminationReason });
          this.phase.set('ended');
        } else {
          this.phase.set('lobby');
        }
      },
      error: (e) => { this.error.set(errorMessage(e)); this.phase.set('error'); },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.tickTimer);
    document.removeEventListener('fullscreenchange', this.onFullscreenChangePassive);
    this.teardown();
  }

  /** Used by the route's canDeactivate guard. */
  canLeave(): boolean {
    return this.phase() !== 'running' && this.phase() !== 'starting';
  }

  // ---------------------------------------------------------------- start

  async start(): Promise<void> {
    if (!this.canStart()) return;
    this.error.set(null);
    this.phase.set('starting');
    if (!this.isOpen()) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        this.phase.set('lobby');
        this.error.set('Full screen was blocked. Allow full screen for this site and try again.');
        return;
      }
    }

    let sid: string | null = null;
    try { sid = sessionStorage.getItem(this.sidKey); } catch { /* ignore */ }
    if (!sid) {
      sid = crypto.randomUUID();
      try { sessionStorage.setItem(this.sidKey, sid); } catch { /* ignore */ }
    }

    this.api.startAttempt(+this.registrationId(), sid).subscribe({
      next: (paper) => this.begin(paper, sid!),
      error: (e) => {
        this.exitFullscreen();
        this.phase.set('lobby');
        const code = errorCode(e);
        if (code === 'ALREADY_ATTEMPTED') {
          this.api.registration(+this.registrationId()).subscribe((r) => {
            this.reg.set(r);
            this.ended.set({ kind: r.attempt?.status ?? 'SUBMITTED', reason: r.attempt?.terminationReason });
            this.phase.set('ended');
          });
          return;
        }
        this.error.set(errorMessage(e));
      },
    });
  }

  private begin(paper: Paper, sid: string): void {
    this.paper.set(paper);
    this.offset.set(Date.parse(paper.serverNow) - Date.now());
    this.violationCount.set(paper.violationCount);

    if (paper.status !== 'IN_PROGRESS') {
      this.end(paper.status, paper.terminationReason);
      return;
    }

    const map: Record<number, LocalAnswer> = {};
    const seen = new Set<number>();
    for (const a of paper.answers) {
      map[a.questionId] = { response: a.response ?? null, marked: a.markedForReview };
      seen.add(a.questionId);
    }
    this.answers.set(map);
    const firstOpen = Math.max(0, paper.questions.findIndex((q) => !map[q.id]?.response));
    this.visited.set(seen);
    this.goTo(firstOpen);

    this.phase.set('running');
    if (paper.mode !== 'OPEN') {
      this.attachGuards();
      setTimeout(() => (this.armed = true), 1500);
    }
    this.connect(sid);
    this.retryTimer = setInterval(() => {
      this.retryDirty();
    }, 5000);
    this.clockTimer = setInterval(() => {
      if (this.phase() === 'running' && this.remainingMs() <= 0) this.onTimeUp();
    }, 1000);
  }

  // ---------------------------------------------------------------- navigation & answers

  goTo(index: number): void {
    const list = this.questions();
    if (index < 0 || index >= list.length) return;
    this.commitNumeric();
    this.current.set(index);
    const q = list[index];
    this.visited.update((s) => new Set(s).add(q.id));
    this.numericDraft.set(q.type === 'NUMERIC' ? this.answers()[q.id]?.response ?? '' : '');
  }

  goToQuestion(id: number): void {
    this.goTo(this.questions().findIndex((q) => q.id === id));
  }

  selectOption(i: number): void {
    const q = this.q();
    if (!q) return;
    if (q.type === 'SINGLE') {
      this.setAnswer(q.id, { response: String(i) });
    } else if (q.type === 'MULTIPLE') {
      const cur = new Set((this.answers()[q.id]?.response ?? '').split(',').filter(Boolean).map(Number));
      if (cur.has(i)) cur.delete(i); else cur.add(i);
      this.setAnswer(q.id, { response: cur.size ? [...cur].sort((a, b) => a - b).join(',') : null });
    }
  }

  isSelected(i: number): boolean {
    const q = this.q();
    if (!q) return false;
    const r = this.answers()[q.id]?.response;
    if (!r) return false;
    return q.type === 'SINGLE' ? r === String(i) : r.split(',').includes(String(i));
  }

  onNumericInput(value: string): void {
    if (!/^-?\d*\.?\d*$/.test(value) || value.length > 20) return;
    this.numericDraft.set(value);
    if (this.numericTimer) clearTimeout(this.numericTimer);
    this.numericTimer = setTimeout(() => this.commitNumeric(), 700);
  }

  onNumericBlur(): void {
    this.commitNumeric();
  }

  private commitNumeric(): void {
    if (this.numericTimer) { clearTimeout(this.numericTimer); this.numericTimer = null; }
    const q = this.q();
    if (!q || q.type !== 'NUMERIC') return;
    const v = this.numericDraft().trim();
    const valid = v !== '' && v !== '-' && v !== '.' && !isNaN(Number(v));
    const next = valid ? v : null;
    if ((this.answers()[q.id]?.response ?? null) !== next) this.setAnswer(q.id, { response: next });
  }

  clearResponse(): void {
    const q = this.q();
    if (!q) return;
    this.numericDraft.set('');
    this.setAnswer(q.id, { response: null });
  }

  saveAndNext(): void {
    this.commitNumeric();
    this.goTo(Math.min(this.current() + 1, this.questions().length - 1));
  }

  markAndNext(): void {
    this.commitNumeric();
    const q = this.q();
    if (q) this.setAnswer(q.id, { marked: !(this.answers()[q.id]?.marked ?? false) });
    this.goTo(Math.min(this.current() + 1, this.questions().length - 1));
  }

  cell(id: number): CellState {
    return this.cellState(id, this.answers(), this.visited());
  }

  private cellState(id: number, a: Record<number, LocalAnswer>, v: ReadonlySet<number>): CellState {
    const x = a[id];
    const has = !!x?.response;
    if (x?.marked) return has ? 'answered-review' : 'review';
    if (has) return 'answered';
    return v.has(id) ? 'skipped' : 'fresh';
  }

  private setAnswer(qid: number, patch: Partial<LocalAnswer>): void {
    this.answers.update((m) => ({ ...m, [qid]: { ...(m[qid] ?? { response: null, marked: false }), ...patch } }));
    this.dirty.add(qid);
    this.queueSave(qid);
  }

  /** Saves are serialised per question and always send the latest local value. */
  private queueSave(qid: number): Promise<void> {
    const prev = this.chains[qid] ?? Promise.resolve();
    const next = prev.then(() => this.save(qid));
    this.chains[qid] = next;
    return next;
  }

  private async save(qid: number): Promise<void> {
    const p = this.paper();
    if (!p || this.phase() !== 'running' || !this.dirty.has(qid)) return;
    const a = this.answers()[qid] ?? { response: null, marked: false };
    this.saving.update((n) => n + 1);
    try {
      await firstValueFrom(this.api.saveAnswer(p.attemptId, qid, a.response, a.marked));
      const latest = this.answers()[qid];
      if (latest?.response === a.response && latest?.marked === a.marked) this.dirty.delete(qid);
      this.savedAt.set(Date.now());
      this.saveFailed.set(false);
    } catch (e) {
      if (errorCode(e) === 'ATTEMPT_CLOSED') this.syncEndedFromServer();
      else this.saveFailed.set(true);
    } finally {
      this.saving.update((n) => n - 1);
    }
  }

  private retryDirty(): void {
    for (const qid of this.dirty) this.queueSave(qid);
  }

  // ---------------------------------------------------------------- submit & end

  openSubmit(): void {
    this.commitNumeric();
    this.confirmOpen.set(true);
  }

  async submit(): Promise<void> {
    const p = this.paper();
    if (!p || this.submitting()) return;
    this.submitting.set(true);
    this.commitNumeric();
    await Promise.allSettled([...this.dirty].map((id) => this.queueSave(id)));
    this.api.submit(p.attemptId).subscribe({
      next: (res) => { this.confirmOpen.set(false); this.end(res.status, res.terminationReason); },
      error: (e) => {
        this.submitting.set(false);
        if (errorCode(e) === 'ATTEMPT_CLOSED') this.syncEndedFromServer();
        else this.error.set(errorMessage(e, 'Could not submit. Check your connection — we will keep trying.'));
      },
    });
  }

  private onTimeUp(): void {
    if (this.autoSubmitted) return;
    this.autoSubmitted = true;
    this.submit();
  }

  private syncEndedFromServer(): void {
    this.api.registration(+this.registrationId()).subscribe((r) => {
      this.reg.set(r);
      if (r.attempt && r.attempt.status !== 'IN_PROGRESS') this.end(r.attempt.status, r.attempt.terminationReason);
    });
  }

  private end(kind: EndKind, reason?: string): void {
    if (this.ended()) return;
    this.ended.set({ kind, reason });
    this.phase.set('ended');
    this.confirmOpen.set(false);
    this.warning.set(null);
    this.teardown();
    this.exitFullscreen();
    try { sessionStorage.removeItem(this.sidKey); } catch { /* ignore */ }
    this.api.registration(+this.registrationId()).subscribe((r) => this.reg.set(r));
  }

  refreshReg(): void {
    this.api.registration(+this.registrationId()).subscribe((r) => this.reg.set(r));
  }

  private teardown(): void {
    this.guards?.abort();
    this.guards = null;
    this.armed = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
    if (this.wsTimer) clearTimeout(this.wsTimer);
    if (this.numericTimer) clearTimeout(this.numericTimer);
    this.pingTimer = this.retryTimer = null;
    this.wsTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
  }

  private exitFullscreen(): void {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  async returnToFullscreen(): Promise<void> {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { /* user must allow */ }
    this.warning.set(null);
  }

  dismissWarning(): void {
    if (!document.fullscreenElement) this.returnToFullscreen();
    else this.warning.set(null);
  }

  // ---------------------------------------------------------------- websocket

  private connect(sid: string): void {
    const p = this.paper();
    const token = this.auth.token();
    if (!p || !token || this.phase() !== 'running') return;
    this.wsState.set(this.wsRetry === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(wsUrl('/ws/exam', { token, attemptId: p.attemptId, sid }));
    this.ws = ws;
    let pingSentAt = 0;

    ws.onopen = () => {
      this.wsRetry = 0;
      this.wsState.set('live');
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) { pingSentAt = Date.now(); ws.send('{"type":"PING"}'); }
      }, 15000);
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case 'HELLO':
          if (msg.serverNow) this.offset.set(Date.parse(msg.serverNow) - Date.now());
          if (msg.violationCount !== undefined) this.violationCount.set(msg.violationCount);
          break;
        case 'PONG':
          if (msg.serverNow && pingSentAt) {
            const rtt = Date.now() - pingSentAt;
            this.offset.set(Date.parse(msg.serverNow) + rtt / 2 - Date.now());
          }
          break;
        case 'WARNING':
          this.violationCount.set(msg.violationCount ?? this.violationCount());
          if (msg.flagged) this.underReview.set(true);
          if (msg.counted) this.warning.set({ label: msg.label ?? 'Integrity warning', count: msg.violationCount ?? 0, tolerance: msg.tolerance ?? 0, flagged: !!msg.flagged });
          break;
        case 'REVIEW_CLEARED':
          this.underReview.set(false);
          this.notice.set(msg.message ?? 'An invigilator reviewed your attempt. You may continue.');
          setTimeout(() => this.notice.set(null), 8000);
          break;
        case 'ENDED':
          this.end(msg.status ?? 'SUBMITTED', msg.reason);
          break;
        case 'REJECTED':
          if (msg.code === 'SUPERSEDED') this.end('SUPERSEDED', msg.message);
          else this.syncEndedFromServer();
          break;
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // replaced or torn down
      this.ws = null;
      if (this.phase() !== 'running') return;
      this.wsState.set('reconnecting');
      const delay = Math.min(8000, 1000 * 2 ** this.wsRetry++);
      this.wsTimer = setTimeout(() => this.connect(sid), delay);
    };
  }

  // ---------------------------------------------------------------- integrity guards

  private attachGuards(): void {
    this.guards?.abort();
    const ac = new AbortController();
    this.guards = ac;
    const opts = { signal: ac.signal, capture: true };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.report('TAB_HIDDEN');
    }, opts);

    window.addEventListener('blur', () => this.report('WINDOW_BLUR'), opts);

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) this.report('FULLSCREEN_EXIT');
    }, opts);

    const block = (kind: 'COPY_PASTE' | 'CONTEXT_MENU') => (e: Event) => { e.preventDefault(); this.report(kind); };
    document.addEventListener('copy', block('COPY_PASTE'), opts);
    document.addEventListener('cut', block('COPY_PASTE'), opts);
    document.addEventListener('paste', block('COPY_PASTE'), opts);
    document.addEventListener('contextmenu', block('CONTEXT_MENU'), opts);
    document.addEventListener('dragstart', (e) => e.preventDefault(), opts);
    document.addEventListener('selectstart', (e) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    }, opts);

    document.addEventListener('keydown', (e) => this.onKeyDown(e), opts);
    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => undefined);
        this.report('SCREEN_CAPTURE');
      }
    }, opts);

    window.addEventListener('beforeunload', (e) => { e.preventDefault(); }, opts);

    const scr = screen as unknown as EventTarget & { isExtended?: boolean };
    if (typeof scr.addEventListener === 'function') {
      scr.addEventListener('change', () => { if (scr.isExtended) this.report('MULTI_SCREEN'); }, { signal: ac.signal });
    }

    // Docked developer tools shrink the viewport while the window stays full screen.
    const devtools = setInterval(() => {
      if (this.phase() !== 'running') return;
      if (!document.fullscreenElement) { this.devtoolsFlagged = false; return; }
      const open = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160;
      if (open && !this.devtoolsFlagged) {
        this.devtoolsFlagged = true;
        this.report('DEVTOOLS');
      } else if (!open) {
        this.devtoolsFlagged = false;
      }
    }, 1000);
    ac.signal.addEventListener('abort', () => clearInterval(devtools));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const inNumeric = e.target instanceof HTMLInputElement && e.target.dataset['numeric'] === 'true';
    const combo = e.ctrlKey || e.metaKey || e.altKey;
    if (e.key === 'PrintScreen') { e.preventDefault(); return; }
    if (FUNCTION_KEY.test(e.key) || (combo && e.key !== 'Control' && e.key !== 'Meta' && e.key !== 'Alt' && e.key !== 'Shift')) {
      e.preventDefault();
      e.stopPropagation();
      const k = [e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && 'Shift', e.key].filter(Boolean).join('+');
      this.report('SHORTCUT', k);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); return; }
    if (!inNumeric && e.key === 'Backspace') e.preventDefault(); // no accidental back-navigation
  }

  private report(kind: string, detail?: string): void {
    if (this.phase() !== 'running' || !this.armed) return;
    const t = Date.now();
    if (t - (this.lastSent[kind] ?? 0) < 1000) return;
    this.lastSent[kind] = t;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'VIOLATION', kind, detail }));
      return;
    }
    const p = this.paper();
    if (!p) return;
    this.api.reportEvent(p.attemptId, kind, detail).subscribe({
      next: (o: ViolationOutcome) => {
        if (o.terminated) { this.end('TERMINATED', o.reason); return; }
        this.violationCount.set(o.violationCount);
        if (o.flagged) this.underReview.set(true);
        if (o.counted) this.warning.set({ label: o.label, count: o.violationCount, tolerance: o.tolerance, flagged: o.flagged });
      },
    });
  }

  private onFullscreenChangePassive = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  // ---------------------------------------------------------------- misc

  backToDashboard(): void {
    this.router.navigateByUrl('/app');
  }

  typeLabel(q: PaperQuestion): string {
    return q.type === 'SINGLE' ? 'Single correct' : q.type === 'MULTIPLE' ? 'One or more correct' : 'Numeric answer';
  }

  endTitle(kind: EndKind): string {
    switch (kind) {
      case 'SUBMITTED': return 'Submitted';
      case 'AUTO_SUBMITTED': return 'Time’s up';
      case 'TERMINATED': return 'Attempt cancelled';
      case 'SUPERSEDED': return 'This window is closed';
      default: return 'Exam in progress';
    }
  }
}
