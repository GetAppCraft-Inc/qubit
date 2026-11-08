import { Component, input } from '@angular/core';

/** Full lockup (mark + wordmark image) for light surfaces, or mark + live type for dark ones. */
@Component({
  selector: 'app-logo',
  template: `
    @if (variant() === 'full') {
      <img src="brand/qubit-logo.png" alt="Qubit" [style.height.px]="size()" />
    } @else {
      <span class="lockup" [class.inverse]="variant() === 'inverse'" [style.--s]="size() + 'px'">
        <img src="brand/qubit-mark.png" alt="" />
        @if (variant() !== 'mark') { <span class="word">Qubit</span> }
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; }
    img { width: auto; display: block; }
    .lockup { display: inline-flex; align-items: center; gap: calc(var(--s) * .32); }
    .lockup img { height: var(--s); }
    .word { font-weight: 700; font-size: calc(var(--s) * .86); letter-spacing: -0.035em; line-height: 1; color: var(--ink); }
    .inverse .word { color: #fff; }
  `,
})
export class Logo {
  variant = input<'full' | 'mark' | 'inverse' | 'compact'>('full');
  size = input(28);
}
