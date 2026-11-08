import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

/**
 * Renders question text with LaTeX: `$…$` inline, `$$…$$` display, `\$` for a literal dollar.
 * Plain text is HTML-escaped and keeps its line breaks; KaTeX runs with trust disabled, so the
 * output is safe to bypass Angular's sanitizer (which would otherwise strip KaTeX's inline styles).
 */
@Component({
  selector: 'app-math',
  template: `<span class="math-text" [innerHTML]="html()"></span>`,
  styles: `
    :host { display: inline; }
    .math-text { white-space: normal; }
    :host ::ng-deep .katex { font-size: 1.08em; }
    :host ::ng-deep .katex-display { margin: .6em 0; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
  `,
})
export class MathText {
  private sanitizer = inject(DomSanitizer);
  text = input<string | null | undefined>('');

  protected html = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(renderMath(this.text() ?? '')));
}

const cache = new Map<string, string>();

export function renderMath(src: string): string {
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '\\' && src[i + 1] === '$') { out += '$'; i += 2; continue; }
    if (src[i] === '$') {
      const display = src[i + 1] === '$';
      const open = display ? 2 : 1;
      const close = findClose(src, i + open, display);
      if (close > 0) {
        const tex = src.slice(i + open, close);
        out += katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', output: 'html' });
        i = close + open;
        continue;
      }
    }
    // plain text run
    let j = i;
    while (j < src.length && src[j] !== '$' && !(src[j] === '\\' && src[j + 1] === '$')) j++;
    if (j === i) j = i + 1;
    out += escape(src.slice(i, j));
    i = j;
  }
  if (cache.size > 500) cache.clear();
  cache.set(src, out);
  return out;
}

function findClose(src: string, from: number, display: boolean): number {
  for (let k = from; k < src.length; k++) {
    if (src[k] === '\\') { k++; continue; }
    if (src[k] === '$') {
      if (!display) return k;
      if (src[k + 1] === '$') return k;
    }
  }
  return -1;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>') // **bold** (after escaping, so it can't inject HTML)
    .replace(/\n/g, '<br>');
}
