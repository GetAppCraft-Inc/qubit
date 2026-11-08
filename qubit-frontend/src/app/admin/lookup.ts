import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { RegistrationRow } from '../core/models';
import { Barcode } from '../shared/barcode';
import { attemptBadge, regStatusBadge } from '../shared/status';

@Component({
  selector: 'app-lookup',
  imports: [RouterLink, IstPipe, Barcode],
  template: `
    <div class="page page-narrow">
      <div class="page-head">
        <div>
          <h1>Hall ticket lookup</h1>
          <p>Type a hall ticket number, or scan the barcode — most USB scanners type straight into this box.</p>
        </div>
      </div>

      <form class="search" (submit)="$event.preventDefault(); find()">
        <input class="input mono" autofocus [value]="query()" (input)="query.set($any($event.target).value.toUpperCase())"
               placeholder="QB26JM7K4PX2Q9" aria-label="Hall ticket number" spellcheck="false" autocomplete="off" />
        <button class="btn btn-primary" type="submit" [disabled]="busy() || !query().trim()">Look up</button>
      </form>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (result(); as r) {
        <article class="card res">
          <div class="res-head">
            <div>
              <p class="eyebrow">Candidate</p>
              <h2>{{ r.candidateName }}</h2>
              <p class="muted">{{ r.candidateEmail }}</p>
            </div>
            <span [class]="badge(r).cls">{{ badge(r).label }}</span>
          </div>
          <dl class="grid">
            <div><dt>Exam</dt><dd><a [routerLink]="['/admin/exams', r.examId]" class="link">{{ r.examTitle }}</a></dd></div>
            <div><dt>Slot</dt><dd>{{ r.slotStartsAt | ist }}</dd></div>
            <div><dt>Registered</dt><dd>{{ r.registeredAt | ist }}</dd></div>
            <div><dt>Started</dt><dd>{{ r.startedAt | ist }}</dd></div>
            <div><dt>Finished</dt><dd>{{ r.finishedAt | ist }}</dd></div>
            <div><dt>Score</dt><dd class="mono">{{ r.score ?? '—' }}@if (r.score !== undefined) { / {{ r.maxScore }} }</dd></div>
            <div><dt>Warnings</dt><dd class="mono">{{ r.violationCount ?? '—' }}</dd></div>
            @if (r.terminationReason) { <div class="full"><dt>Termination reason</dt><dd class="bad">{{ r.terminationReason }}</dd></div> }
          </dl>
          <div class="code">
            <app-barcode [value]="r.hallTicketNo" [height]="48" />
            <span class="mono">{{ r.hallTicketNo }}</span>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    .search { display: flex; gap: 10px; margin-bottom: 20px; }
    .search .input { height: 48px; font-size: 18px; letter-spacing: .12em; }
    .search .btn { height: 48px; }
    .res { padding: 24px; }
    .res-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .res-head h2 { margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 22px 0; padding: 18px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .grid dt { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .grid dd { margin: 3px 0 0; font-weight: 550; }
    .grid .full { grid-column: 1 / -1; }
    .bad { color: var(--danger); }
    .code { max-width: 320px; margin: 0 auto; text-align: center; }
    .code .mono { display: block; letter-spacing: .25em; margin-top: 6px; font-size: 13px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr 1fr; } }
  `,
})
export class LookupPage {
  private api = inject(Api);
  protected query = signal('');
  protected result = signal<RegistrationRow | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);

  find(): void {
    const q = this.query().trim();
    if (!q) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.hallTicket(q).subscribe({
      next: (r) => { this.result.set(r); this.busy.set(false); },
      error: (e) => { this.result.set(null); this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }

  badge(r: RegistrationRow) {
    return r.attemptStatus ? attemptBadge(r.attemptStatus) : regStatusBadge(r.status);
  }
}
