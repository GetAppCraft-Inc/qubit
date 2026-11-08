import { Component, inject, input, output, signal } from '@angular/core';
import { IstPipe } from '../core/format';
import { IntegrityCaseRow } from '../core/models';
import { StaffAlerts } from '../core/staff-alerts.service';

/** Invigilator decision on a flagged attempt: cancel it, or let the candidate continue. */
@Component({
  selector: 'app-case-dialog',
  imports: [IstPipe],
  template: `
    @let c = case();
    <div class="backdrop" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <p class="eyebrow mono">Integrity review · case #{{ c.id }}</p>
        <h3 id="cd-title">{{ c.candidateName }}</h3>
        <p class="muted small mono">{{ c.hallTicketNo }} · {{ c.examTitle }}</p>

        <dl class="facts">
          <div><dt>Latest flag</dt><dd>{{ c.reason }}</dd></div>
          <div><dt>Warnings</dt><dd class="mono">{{ c.violationCount }} counted · limit {{ c.tolerance }}</dd></div>
          <div><dt>Flagged at</dt><dd class="mono">{{ c.openedAt | ist: 'timeSec' }}</dd></div>
          <div><dt>Attempt</dt><dd>{{ attemptLabel(c.attemptStatus) }}</dd></div>
        </dl>

        <div class="field">
          <label for="cd-note">Note <span class="muted">(optional; sent to the candidate if you cancel)</span></label>
          <input id="cd-note" class="input" [value]="note()" (input)="note.set($any($event.target).value)"
                 placeholder="e.g. Left full screen four times in two minutes" maxlength="300" />
        </div>

        <p class="hint small muted">
          Cancelling ends the attempt now{{ c.attemptStatus === 'IN_PROGRESS' ? '' : ' and withdraws the submitted result' }}.
          The candidate is emailed and can appeal; if you approve the appeal they get a fresh attempt.
        </p>

        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" (click)="closed.emit()" [disabled]="busy()">Later</button>
          <button class="btn btn-ghost" type="button" (click)="dismiss()" [disabled]="busy()">Let them continue</button>
          <button class="btn btn-danger" type="button" (click)="cancel()" [disabled]="busy()">Cancel attempt</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .eyebrow { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--warn); margin: 0 0 6px; }
    h3 { margin: 0; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin: 18px 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg, #faf9f5); }
    .facts div { min-width: 0; }
    .facts div:first-child { grid-column: 1 / -1; }
    dt { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 3px; }
    dd { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
    .hint { margin: 10px 0 0; line-height: 1.5; }
    .dialog-actions { flex-wrap: wrap; }
  `,
})
export class CaseDialog {
  private alerts = inject(StaffAlerts);
  readonly case = input.required<IntegrityCaseRow>();
  readonly closed = output<void>();
  protected note = signal('');
  protected busy = signal(false);

  attemptLabel(s: string): string {
    return s === 'IN_PROGRESS' ? 'Still writing' : s === 'TERMINATED' ? 'Already terminated' : 'Submitted';
  }

  cancel(): void {
    this.busy.set(true);
    this.alerts.cancel(this.case(), this.note().trim(), () => this.closed.emit());
    setTimeout(() => this.busy.set(false), 1500);
  }

  dismiss(): void {
    this.busy.set(true);
    this.alerts.dismiss(this.case(), this.note().trim(), () => this.closed.emit());
    setTimeout(() => this.busy.set(false), 1500);
  }
}
