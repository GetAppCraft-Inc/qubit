import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../shared/logo';

/** Two-column frame for auth screens: form on the left, a quiet hall-ticket illustration on the right. */
@Component({
  selector: 'app-auth-frame',
  imports: [RouterLink, Logo],
  template: `
    <div class="frame">
      <div class="left">
        <a routerLink="/" class="home" aria-label="Back to Qubit home"><app-logo [size]="26" /></a>
        <div class="form-wrap"><ng-content /></div>
        <p class="legal">Timed, proctored assessments for JEE, NEET and more.</p>
      </div>
      <aside class="right" aria-hidden="true">
        <div class="ticket">
          <div class="t-head">
            <img src="brand/qubit-mark.png" alt="" />
            <div>
              <div class="t-kicker">Hall ticket</div>
              <div class="t-title">NEET-UG · Full Mock 03</div>
            </div>
          </div>
          <dl class="t-grid">
            <div><dt>Candidate</dt><dd>Ananya Iyer</dd></div>
            <div><dt>Slot</dt><dd>Sun, 14 Dec · 2:00 PM</dd></div>
            <div><dt>Duration</dt><dd>3 h</dd></div>
            <div><dt>Attempts</dt><dd>1</dd></div>
          </dl>
          <div class="t-bars">
            @for (w of bars; track $index) { <i [style.width.px]="w"></i> }
          </div>
          <div class="t-no">QB26NU4XK7M2PD</div>
        </div>
        <p class="caption">Every registration comes with a hall ticket like this — unique number, scannable barcode, your slot.</p>
      </aside>
    </div>
  `,
  styles: `
    .frame { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .left { display: flex; flex-direction: column; padding: 28px 40px; }
    .home { display: inline-flex; align-self: flex-start; }
    .form-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; max-width: 400px; margin: 0 auto; padding: 48px 0; }
    .legal { font-size: 12.5px; color: var(--faint); text-align: center; }
    .right { background: var(--paper-2); border-left: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;
      background-image: radial-gradient(var(--line-strong) 1px, transparent 1px); background-size: 18px 18px; }
    .ticket { width: 360px; background: #fff; border: 1px solid var(--line-strong); border-radius: 12px; padding: 22px; box-shadow: var(--shadow-3); transform: rotate(-2deg); position: relative; }
    .ticket::after { content: ''; position: absolute; left: 22px; right: 22px; top: 76px; border-top: 1px dashed var(--line-strong); }
    .t-head { display: flex; gap: 12px; align-items: center; padding-bottom: 20px; }
    .t-head img { width: 34px; height: 34px; }
    .t-kicker { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
    .t-title { font-weight: 600; letter-spacing: -0.01em; }
    .t-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 18px; }
    .t-grid dt { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .t-grid dd { margin: 2px 0 0; font-size: 13.5px; font-weight: 550; }
    .t-bars { display: flex; height: 44px; align-items: stretch; justify-content: center; overflow: hidden; }
    .t-bars i { background: var(--ink); display: block; flex: none; }
    .t-bars i:nth-child(even) { background: transparent; }
    .t-no { font-family: var(--mono); font-size: 12px; letter-spacing: .22em; margin-top: 6px; text-align: center; }
    .caption { max-width: 340px; text-align: center; margin-top: 40px; font-size: 13.5px; color: var(--muted); }
    @media (max-width: 900px) {
      .frame { grid-template-columns: 1fr; }
      .right { display: none; }
      .left { padding: 20px 16px; }
    }
  `,
})
export class AuthFrame {
  protected readonly bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3]
    .map((w) => w * 1.6);
}
