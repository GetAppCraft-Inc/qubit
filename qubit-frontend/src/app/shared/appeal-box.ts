import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { Registration } from '../core/models';
import { ToastService } from '../core/toast.service';

/**
 * Candidate side of an appeal: the form after an attempt was cancelled, then its status
 * (waiting / rejected / retake approved).
 */
@Component({
  selector: 'app-appeal-box',
  imports: [IstPipe, RouterLink],
  template: `
    @let r = registration();
    @if (r.retakeUntil) {
      <div class="box ok">
        <p class="eyebrow">Appeal approved</p>
        <h3>You can take the exam again</h3>
        <p>Your earlier attempt has been set aside. Start your fresh attempt before <strong>{{ r.retakeUntil | ist }}</strong>.
          @if (r.appeal?.decisionNote) { <br><span class="muted">Invigilator: “{{ r.appeal?.decisionNote }}”</span> }
        </p>
        <a [routerLink]="['/exam', r.id]" class="btn btn-brand">Start retake →</a>
      </div>
    } @else if (r.canAppeal) {
      @if (!open()) {
        <div class="box">
          <p class="eyebrow">Something went wrong?</p>
          <h3>You can appeal this decision</h3>
          <p>If the attempt ended because of something outside your control (a power cut, a dropped connection,
            a system pop-up), tell the invigilator what happened. If they agree, you'll get a fresh attempt.</p>
          <button class="btn btn-primary" type="button" (click)="open.set(true)">Write an appeal</button>
        </div>
      } @else {
        <form class="box" (submit)="$event.preventDefault(); send()">
          <p class="eyebrow">Appeal</p>
          <h3>What happened?</h3>
          <label class="sr" for="appeal-msg">Your explanation</label>
          <textarea id="appeal-msg" class="input" rows="5" maxlength="2000" [value]="message()"
                    (input)="message.set($any($event.target).value)"
                    placeholder="At around 10:42 my laptop showed a Windows update prompt and left full screen. I returned straight away…"></textarea>
          <div class="foot">
            <span class="muted small mono">{{ message().trim().length }} / 2000 · at least 20 characters</span>
            <span class="grow"></span>
            <button class="btn btn-ghost" type="button" (click)="open.set(false)" [disabled]="busy()">Cancel</button>
            <button class="btn btn-primary" type="submit" [disabled]="busy() || !valid()">Submit appeal</button>
          </div>
          <p class="muted small">You can submit one appeal per attempt. You'll get an email with the decision.</p>
        </form>
      }
    } @else if (r.appeal; as a) {
      <div class="box" [class.bad]="a.status === 'REJECTED'">
        <p class="eyebrow">{{ a.status === 'PENDING' ? 'Appeal under review' : a.status === 'REJECTED' ? 'Appeal not approved' : 'Appeal approved' }}</p>
        @if (a.status === 'PENDING') {
          <h3>An invigilator will review your appeal</h3>
          <p class="muted">Submitted {{ a.createdAt | ist }}. We'll email you when there's a decision.</p>
        } @else if (a.status === 'REJECTED') {
          <h3>The cancellation stands</h3>
          <p class="muted">Decided {{ a.decidedAt | ist }}.@if (a.decisionNote) { Invigilator: “{{ a.decisionNote }}” }</p>
        } @else {
          <p class="muted">Decided {{ a.decidedAt | ist }}.</p>
        }
        <details><summary class="small">Your message</summary><blockquote>{{ a.message }}</blockquote></details>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .box { border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; background: var(--surface); text-align: left; }
    .box.ok { border-color: #c4e3cf; background: #f7fcf9; }
    .box.bad { border-color: #f2c9c3; }
    .eyebrow { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin: 0 0 4px; }
    .box.ok .eyebrow { color: var(--ok); }
    h3 { margin: 0 0 6px; font-size: 17px; }
    p { margin: 0 0 12px; line-height: 1.55; color: var(--ink-2); }
    textarea { width: 100%; resize: vertical; min-height: 120px; font: inherit; line-height: 1.5; margin: 6px 0 10px; }
    .foot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .grow { flex: 1; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    details { margin-top: 4px; }
    summary { cursor: pointer; color: var(--muted); }
    blockquote { margin: 8px 0 0; padding: 10px 12px; border-left: 2px solid var(--line-strong); white-space: pre-wrap; font-size: 14px; color: var(--ink-2); }
  `,
})
export class AppealBox {
  private api = inject(Api);
  private toast = inject(ToastService);
  readonly registration = input.required<Registration>();
  /** Emitted after a successful submit, so the host can reload the registration. */
  readonly changed = output<void>();

  protected open = signal(false);
  protected message = signal('');
  protected busy = signal(false);
  protected valid = computed(() => this.message().trim().length >= 20);

  send(): void {
    if (!this.valid()) return;
    this.busy.set(true);
    this.api.submitAppeal(this.registration().id, this.message().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.open.set(false);
        this.toast.ok('Appeal submitted. You\'ll get an email with the decision.');
        this.changed.emit();
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
