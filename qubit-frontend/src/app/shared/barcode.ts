import { Component, ElementRef, effect, input, viewChild } from '@angular/core';
import JsBarcode from 'jsbarcode';

/** Code 128 barcode rendered to inline SVG (crisp on screen and in print). */
@Component({
  selector: 'app-barcode',
  template: `<svg #svg role="img" [attr.aria-label]="'Barcode ' + value()"></svg>`,
  styles: `:host { display: block; } svg { display: block; width: 100%; height: auto; }`,
})
export class Barcode {
  value = input.required<string>();
  height = input(64);
  private svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  constructor() {
    effect(() => {
      const el = this.svg().nativeElement;
      try {
        JsBarcode(el, this.value(), {
          format: 'CODE128',
          height: this.height(),
          width: 2,
          margin: 0,
          displayValue: false,
          background: 'transparent',
          lineColor: '#121116',
        });
      } catch {
        el.innerHTML = '';
      }
    });
  }
}
