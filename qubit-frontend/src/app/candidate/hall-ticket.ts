import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DurationPipe, errorMessage, formatIst, IstPipe, until } from '../core/format';
import { CATEGORY_LABEL, PublicSlot, Registration } from '../core/models';
import { ToastService } from '../core/toast.service';
import { Barcode } from '../shared/barcode';
import { Logo } from '../shared/logo';
import { SlotPicker } from '../shared/slot-picker';
import { AppealBox } from '../shared/appeal-box';
import { canEnter, nowSignal, registrationBadge } from '../shared/status';

@Component({
  selector: 'app-hall-ticket',
  imports: [RouterLink, IstPipe, DurationPipe, Barcode, Logo, SlotPicker, AppealBox],
  template: `
    <div class="page">
      <div class="spread no-print bar">
        <a routerLink="/app/registrations" class="back small">← My registrations</a>
        @if (reg()) {
          <div class="row">
            @if (enterable()) {
              <a [routerLink]="['/exam', reg()!.id]" class="btn btn-brand">
                {{ reg()!.attempt ? 'Return to exam' : 'Enter exam hall' }} →
              </a>
            }
            <button class="btn btn-ghost" type="button" (click)="print()">Print / save PDF</button>
          </div>
        }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (reg(); as r) {
        <!-- result -->
        @if (r.attempt && r.attempt.status !== 'IN_PROGRESS') {
          <section class="result card no-print" [class.bad]="r.attempt.status === 'TERMINATED'">
            @if (r.attempt.status === 'TERMINATED') {
              <div>
                <p class="eyebrow">Attempt terminated</p>
                <h2>{{ r.attempt.terminationReason || 'The attempt was ended.' }}</h2>
                <p class="muted small">Ended {{ r.attempt.finishedAt | ist }}.</p>
              </div>
            } @else if (r.attempt.resultsVisible) {
              <div>
                <p class="eyebrow">Your result</p>
                <h2 class="score mono">{{ r.attempt.score }}<small> / {{ r.attempt.maxScore }}</small></h2>
              </div>
              <dl class="breakdown">
                <div><dt>Correct</dt><dd class="ok">{{ r.attempt.correctCount }}</dd></div>
                <div><dt>Incorrect</dt><dd class="bad">{{ r.attempt.incorrectCount }}</dd></div>
                <div><dt>Unanswered</dt><dd>{{ r.attempt.unansweredCount }}</dd></div>
              </dl>
              <a [routerLink]="['/app/results', r.id]" class="btn btn-primary">Full score report →</a>
            } @else {
              <div>
                <p class="eyebrow">Submitted</p>
                <h2>Your responses are in.</h2>
                <p class="muted small">Results for this assessment will be shared by the organiser.</p>
              </div>
            }
          </section>
        }
        @if (r.retakeUntil || r.canAppeal || (r.appeal && r.attempt?.status === 'TERMINATED')) {
          <app-appeal-box class="no-print appeal" [registration]="r" (changed)="reload()" />
        }

        <!-- the ticket -->
        <article class="ticket">
          <header class="t-head">
            <app-logo [size]="30" />
            <div class="t-kind">
              <span class="eyebrow">Hall ticket</span>
              <span [class]="badge().cls">{{ badge().label }}</span>
            </div>
          </header>

          <div class="t-exam">
            <p class="eyebrow">{{ labels[r.exam.category] }} · {{ r.exam.code }}</p>
            <h1>{{ r.exam.title }}</h1>
          </div>

          <div class="t-grid">
            <div><span>Candidate</span><strong>{{ r.candidateName }}</strong></div>
            <div><span>Email</span><strong>{{ r.candidateEmail }}</strong></div>
            @if (r.exam.mode === 'OPEN') {
              <div><span>Format</span><strong>Open quiz</strong></div>
              <div><span>Opens</span><strong>{{ r.entryOpensAt | ist }}</strong></div>
              <div><span>Closes</span><strong>{{ closesLabel(r.entryClosesAt) }}</strong></div>
            } @else {
              <div><span>Date</span><strong>{{ r.slot.startsAt | ist: 'date' }}</strong></div>
              <div><span>Reporting time</span><strong>{{ r.entryOpensAt | ist: 'time' }} IST</strong></div>
              <div><span>Entry closes</span><strong>{{ r.entryClosesAt | ist: 'time' }} IST</strong></div>
            }
            <div><span>Duration</span><strong>{{ r.exam.durationMinutes | duration }}</strong></div>
            <div><span>Questions · Marks</span><strong>{{ r.exam.questionCount }} · {{ r.exam.totalMarks }}</strong></div>
            <div><span>Attempts allowed</span><strong>1</strong></div>
          </div>

          <div class="t-code">
            <app-barcode [value]="r.hallTicketNo" [height]="70" />
            <div class="t-no mono">{{ r.hallTicketNo }}</div>
          </div>

          <footer class="t-rules">
            <h3>On exam day</h3>
            <ol>
              <li>Sign in on a laptop or desktop with one display. Close other apps and tabs.</li>
              <li>Open this assessment from your dashboard once the slot opens. Entry closes {{ r.exam.lateEntryMinutes }} minutes after the start.</li>
              <li>The exam runs in full screen. Switching tabs, minimising or leaving full screen is recorded{{ r.exam.violationTolerance === 0 ? ' and ends the attempt' : '' }}.</li>
              <li>The clock runs on the server. Your answers save as you go and the paper submits itself when time is up.</li>
            </ol>
          </footer>
        </article>

        <!-- reschedule -->
        @if (canReschedule()) {
          <section class="resched no-print">
            <div class="spread">
              <div>
                <h3>Need a different time?</h3>
                <p class="muted small">You can switch slots until your current one begins ({{ untilSlot() }}).</p>
              </div>
              @if (!slots()) {
                <button class="btn btn-ghost" type="button" (click)="loadSlots()">Change slot</button>
              }
            </div>
            @if (slots(); as list) {
              <div class="picker">
                <app-slot-picker [slots]="list" [currentId]="r.slot.id" [(selected)]="newSlot" />
                <div class="row" style="justify-content: flex-end; margin-top: 14px">
                  <button class="btn btn-quiet" type="button" (click)="slots.set(null)">Cancel</button>
                  <button class="btn btn-primary" type="button" [disabled]="!newSlot() || newSlot() === r.slot.id || busy()" (click)="reschedule()">
                    Move to this slot
                  </button>
                </div>
              </div>
            }
          </section>
        }
      } @else if (!error()) {
        <div class="skeleton" style="height: 420px"></div>
      }
    </div>
  `,
  styles: `
    .bar { margin-bottom: 20px; }
    .back { color: var(--muted); text-decoration: none; }
    .back:hover { color: var(--ink); }

    .result { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 22px 26px; margin-bottom: 20px; flex-wrap: wrap; border-left: 3px solid var(--ok); }
    .result.bad { border-left-color: var(--danger); }
    .result h2 { margin-top: 6px; font-size: 20px; }
    .score { font-size: 40px !important; letter-spacing: -0.02em; }
    .score small { font-size: 18px; color: var(--muted); font-weight: 400; }
    .breakdown { display: flex; gap: 28px; margin: 0; }
    .breakdown dt { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .breakdown dd { margin: 2px 0 0; font-size: 22px; font-weight: 600; }
    .breakdown .ok { color: var(--ok); }
    .breakdown .bad { color: var(--danger); }

    .ticket { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 14px; padding: 32px 36px; box-shadow: var(--shadow-2); max-width: 820px; }
    .t-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 22px; border-bottom: 1px dashed var(--line-strong); }
    .t-kind { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .t-exam { padding: 22px 0 6px; }
    .t-exam h1 { font-size: 28px; margin-top: 6px; letter-spacing: -0.03em; }
    .t-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px 20px; padding: 20px 0 24px; border-bottom: 1px solid var(--line); }
    .t-grid span { display: block; font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .t-grid strong { display: block; margin-top: 3px; font-weight: 550; font-size: 14.5px; word-break: break-word; }
    .t-code { padding: 26px 0 22px; max-width: 420px; margin: 0 auto; text-align: center; }
    .t-no { font-size: 16px; letter-spacing: .3em; margin-top: 10px; font-weight: 500; }
    .t-rules { border-top: 1px dashed var(--line-strong); padding-top: 18px; }
    .t-rules h3 { font-size: 13px; }
    .t-rules ol { margin: 8px 0 0; padding-left: 18px; font-size: 13px; color: var(--ink-2); display: grid; gap: 4px; }

    .resched { max-width: 820px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--line); }
    .picker { margin-top: 14px; }

    @media (max-width: 720px) {
      .ticket { padding: 22px 18px; }
      .t-grid { grid-template-columns: 1fr 1fr; }
    }
    @media print {
      .page { padding: 0; }
      .ticket { box-shadow: none; border-color: #999; max-width: none; }
    }
  `,
})
export class HallTicketPage implements OnInit {
  private api = inject(Api);
  private toast = inject(ToastService);
  protected labels = CATEGORY_LABEL;
  protected now = nowSignal();

  id = input.required<string>();
  protected reg = signal<Registration | null>(null);
  protected error = signal<string | null>(null);
  protected slots = signal<PublicSlot[] | null>(null);
  protected newSlot = signal<number | null>(null);
  protected busy = signal(false);

  protected badge = computed(() => {
    const r = this.reg();
    return r ? registrationBadge(r, this.now()) : { label: '', cls: 'badge' };
  });
  protected enterable = computed(() => {
    const r = this.reg();
    return !!r && canEnter(r, this.now());
  });
  protected canReschedule = computed(() => {
    const r = this.reg();
    return !!r && r.exam.mode !== 'OPEN' && !r.attempt && !r.retakeUntil && r.status === 'REGISTERED' && Date.parse(r.slot.startsAt) > this.now();
  });
  protected untilSlot = computed(() => {
    const r = this.reg();
    return r ? until(Date.parse(r.slot.startsAt) - this.now()) : '';
  });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.api.registration(+this.id()).subscribe({
      next: (r) => this.reg.set(r),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  print(): void { window.print(); }

  closesLabel(iso: string): string {
    return Date.parse(iso) > Date.parse('2099-01-01') ? 'No deadline' : formatIst(iso);
  }

  loadSlots(): void {
    const r = this.reg();
    if (!r) return;
    this.api.exam(r.exam.id).subscribe({
      next: (d) => {
        const list = d.slots.some((s) => s.id === r.slot.id)
          ? d.slots
          : [{ id: r.slot.id, startsAt: r.slot.startsAt, label: r.slot.label, seatsLeft: 0 }, ...d.slots];
        this.slots.set(list);
        this.newSlot.set(r.slot.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  reschedule(): void {
    const r = this.reg();
    const s = this.newSlot();
    if (!r || !s) return;
    this.busy.set(true);
    this.api.reschedule(r.id, s).subscribe({
      next: (updated) => {
        this.reg.set(updated);
        this.slots.set(null);
        this.busy.set(false);
        this.toast.ok('Slot changed. Your hall ticket is updated.');
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
