import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DurationPipe, errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, PublicExamDetail } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SlotPicker } from '../shared/slot-picker';

@Component({
  selector: 'app-exam-detail',
  imports: [RouterLink, IstPipe, DurationPipe, SlotPicker],
  template: `
    <div class="page">
      <a routerLink="/app/exams" class="back small">← All assessments</a>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (detail(); as d) {
        <header class="head">
          <p class="eyebrow">{{ labels[d.exam.category] }} · {{ d.exam.code }}</p>
          <h1>{{ d.exam.title }}</h1>
          @if (d.exam.description) { <p class="desc">{{ d.exam.description }}</p> }
        </header>

        <dl class="facts">
          <div><dt>Duration</dt><dd>{{ d.exam.durationMinutes | duration }}</dd></div>
          <div><dt>Questions</dt><dd>{{ d.exam.questionCount }}</dd></div>
          <div><dt>Total marks</dt><dd>{{ d.exam.totalMarks }}</dd></div>
          <div><dt>Late entry</dt><dd>{{ d.exam.lateEntryMinutes }} min</dd></div>
          <div><dt>Warnings allowed</dt><dd>{{ d.violationTolerance === 0 ? 'None' : d.violationTolerance }}</dd></div>
        </dl>

        <div class="layout">
          <section>
            @if (d.exam.myRegistrationId) {
              <div class="alert alert-ok registered">
                You're registered for this assessment.
                <a [routerLink]="['/app/registrations', d.exam.myRegistrationId]" class="link">View hall ticket →</a>
              </div>
            } @else if (!d.exam.registrationOpen) {
              <div class="alert alert-warn">{{ d.exam.mode === 'OPEN' ? 'This assessment is no longer accepting responses.' : 'Registration for this assessment is closed.' }}</div>
            } @else if (d.exam.mode === 'OPEN') {
              <div class="open-start card card-pad">
                <span class="badge badge-ok">Open quiz</span>
                <h2 class="sec">Start whenever you're ready</h2>
                <p class="muted">No slot to book and no locked window. You get one attempt of {{ d.exam.durationMinutes | duration }};
                  the timer starts the moment you begin@if (d.exam.registrationClosesAt) {, and responses close {{ d.exam.registrationClosesAt | ist }} IST}.</p>
                <button class="btn btn-brand btn-lg" type="button" [disabled]="busy()" (click)="startOpen()">
                  @if (busy()) { <span class="spinner"></span> } Start now →
                </button>
              </div>
            } @else {
              <h2 class="sec">Choose your slot</h2>
              <p class="muted small sec-sub">All times are in IST. You can reschedule from your hall ticket until your slot begins.</p>
              <app-slot-picker [slots]="d.slots" [(selected)]="slotId" />
              <div class="register-bar">
                <span class="muted small">
                  @if (slotId()) { Selected: <strong class="ink">{{ selectedStart() | ist }}</strong> } @else { Pick a slot to continue }
                </span>
                <button class="btn btn-primary btn-lg" [disabled]="!slotId() || busy()" (click)="register()">
                  @if (busy()) { <span class="spinner"></span> } Register &amp; get hall ticket
                </button>
              </div>
            }
          </section>

          <aside class="rules">
            <h3>Before you {{ d.exam.mode === 'OPEN' ? 'start' : 'register' }}</h3>
            @if (d.exam.mode === 'OPEN') {
              <ul>
                <li>One attempt. Once you begin, the timer keeps running even if you close the tab.</li>
                <li>Answers save automatically as you go.</li>
                <li>This is a low-stakes quiz: no full-screen lock or proctoring.</li>
              </ul>
            } @else {
            <ul>
              <li>One attempt only. Once you begin, you can't restart.</li>
              <li>The exam runs in full screen. Leaving it, switching tabs or minimising is recorded@if (d.violationTolerance === 0) { and <strong>ends your attempt immediately</strong>}.</li>
              <li>Use a laptop or desktop with a single display and a stable connection.</li>
              <li>The timer runs on our server. Closing the window doesn't pause it.</li>
            </ul>
            }
            @if (d.instructions) {
              <h3 class="mt">Instructions</h3>
              <p class="instr">{{ d.instructions }}</p>
            }
          </aside>
        </div>
      } @else if (!error()) {
        <div class="skeleton" style="height: 240px; margin-top: 24px"></div>
      }
    </div>
  `,
  styles: `
    .back { color: var(--muted); text-decoration: none; display: inline-block; margin-bottom: 20px; }
    .back:hover { color: var(--ink); }
    .head h1 { font-size: clamp(30px, 4vw, 42px); letter-spacing: -0.035em; margin-top: 8px; }
    .desc { color: var(--ink-2); margin-top: 10px; max-width: 70ch; font-size: 16px; }
    .facts { display: grid; grid-template-columns: repeat(5, 1fr); margin: 28px 0 36px; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--line); }
    .facts div { padding: 14px 16px 14px 0; }
    .facts div + div { padding-left: 16px; border-left: 1px solid var(--line); }
    .facts dt { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .facts dd { margin: 4px 0 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; align-items: start; }
    .sec { font-size: 20px; }
    .sec-sub { margin: 4px 0 14px; }
    .register-bar { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; margin-top: 8px; background: var(--paper); border-top: 1px solid var(--line); flex-wrap: wrap; }
    .ink { color: var(--ink); }
    .open-start { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .open-start p { max-width: 60ch; }
    .registered { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .rules { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; }
    .rules h3 { font-size: 14px; }
    .rules ul { margin: 10px 0 0; padding-left: 18px; display: grid; gap: 8px; font-size: 13.5px; color: var(--ink-2); }
    .rules .mt { margin-top: 20px; }
    .instr { font-size: 13.5px; color: var(--ink-2); white-space: pre-line; margin-top: 8px; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .facts { grid-template-columns: repeat(2, 1fr); }
      .facts div + div { border-left: 0; padding-left: 0; }
    }
  `,
})
export class ExamDetailPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected labels = CATEGORY_LABEL;

  id = input.required<string>();
  protected detail = signal<PublicExamDetail | null>(null);
  protected error = signal<string | null>(null);
  protected slotId = signal<number | null>(null);
  protected busy = signal(false);

  ngOnInit(): void {
    this.api.exam(+this.id()).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  selectedStart(): string | undefined {
    return this.detail()?.slots.find((s) => s.id === this.slotId())?.startsAt;
  }

  startOpen(): void {
    const d = this.detail();
    if (!d) return;
    this.busy.set(true);
    this.api.register(d.exam.id, null).subscribe({
      next: (r) => this.router.navigate(['/exam', r.id]),
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  register(): void {
    const d = this.detail();
    const slot = this.slotId();
    if (!d || !slot) return;
    this.busy.set(true);
    this.api.register(d.exam.id, slot).subscribe({
      next: (r) => {
        this.toast.ok('Registered. Your hall ticket is ready.');
        this.router.navigate(['/app/registrations', r.id]);
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
