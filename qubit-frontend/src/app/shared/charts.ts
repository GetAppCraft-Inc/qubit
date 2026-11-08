import { Component, computed, input, signal } from '@angular/core';

export interface Datum { label: string; value: number; tip?: string; }

/* Shared look: one hue (brand violet, validated ≥3:1 on the light surface), recessive grid,
   4px rounded data-ends anchored to the baseline, 2px gaps, hover tooltip, sr-only table. */
const CHART_STYLES = `
  :host { display: block; position: relative; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .base { stroke: var(--line-strong); stroke-width: 1; }
  .tick { font-family: var(--mono); font-size: 10.5px; fill: var(--muted); }
  .mark { fill: var(--brand); transition: opacity .12s; }
  .dim .mark { opacity: .35; }
  .dim .mark.on { opacity: 1; }
  .hit { fill: transparent; cursor: default; }
  .line { fill: none; stroke: var(--brand); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .area { fill: var(--brand); opacity: .07; }
  .dot { fill: var(--brand); stroke: var(--surface); stroke-width: 2; }
  .cross { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
  .tip { position: absolute; pointer-events: none; transform: translate(-50%, calc(-100% - 10px)); background: var(--ink); color: #fff;
         font-size: 12px; line-height: 1.35; padding: 6px 9px; border-radius: 6px; white-space: nowrap; box-shadow: var(--shadow-2); z-index: 5; }
  .tip strong { display: block; font-weight: 600; }
  .empty { font-size: 13px; color: var(--muted); padding: 24px 0; text-align: center; }
`;

/** Vertical columns (histograms, distributions). */
@Component({
  selector: 'app-column-chart',
  template: `
    @if (total() === 0 && emptyText()) {
      <p class="empty">{{ emptyText() }}</p>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" [class.dim]="hover() !== null"
           (mouseleave)="hover.set(null)">
        @for (g of grid(); track g.v) {
          <line class="grid" [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="g.y" [attr.y2]="g.y" />
          <text class="tick" [attr.x]="L - 8" [attr.y]="g.y + 3.5" text-anchor="end">{{ g.v }}</text>
        }
        <line class="base" [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="H - B" [attr.y2]="H - B" />
        @for (b of bars(); track $index) {
          @if (b.h > 0) { <path class="mark" [class.on]="hover() === $index" [attr.d]="b.path" /> }
          <rect class="hit" [attr.x]="b.x - 1" [attr.y]="T" [attr.width]="b.w + 2" [attr.height]="H - B - T"
                (mouseenter)="hover.set($index)" />
          @if (showEvery() === 1 || $index % showEvery() === 0) {
            <text class="tick" [attr.x]="b.x + b.w / 2" [attr.y]="H - B + 16" text-anchor="middle">{{ data()[$index].label }}</text>
          }
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="tipX()" [style.top.%]="tipY()">
          <strong>{{ data()[hover()!].label }}</strong>{{ data()[hover()!].tip ?? data()[hover()!].value }}
        </div>
      }
      <table class="sr-only"><tr><th>{{ xTitle() }}</th><th>{{ yTitle() }}</th></tr>
        @for (d of data(); track $index) { <tr><td>{{ d.label }}</td><td>{{ d.value }}</td></tr> }
      </table>
    }
  `,
  styles: CHART_STYLES,
})
export class ColumnChart {
  data = input.required<Datum[]>();
  ariaLabel = input('Column chart');
  xTitle = input('Category');
  yTitle = input('Value');
  emptyText = input<string>('');
  showEvery = input(1);

  protected readonly W = 640; protected readonly H = 220;
  protected readonly L = 34; protected readonly R = 6; protected readonly T = 10; protected readonly B = 26;
  protected hover = signal<number | null>(null);

  protected total = computed(() => this.data().reduce((s, d) => s + d.value, 0));
  /** Counts stay on whole-number ticks (0, n/2, n with n even). */
  private max = computed(() => {
    const vals = this.data().map((d) => d.value);
    const m = niceMax(Math.max(1, ...vals));
    return vals.every(Number.isInteger) && m < 4 ? 4 : m;
  });
  protected grid = computed(() => {
    const m = this.max();
    return [0, m / 2, m].map((v) => ({ v: Math.round(v * 10) / 10, y: this.y(v) }));
  });
  protected bars = computed(() => {
    const n = this.data().length || 1;
    const slot = (this.W - this.L - this.R) / n;
    const gap = Math.max(2, slot * 0.18);
    return this.data().map((d, i) => {
      const x = this.L + i * slot + gap / 2;
      const w = slot - gap;
      const top = this.y(d.value);
      const h = this.H - this.B - top;
      return { x, w, h, path: roundedTop(x, top, w, h, Math.min(4, w / 2, h)) };
    });
  });
  protected tipX = computed(() => {
    const i = this.hover(); const b = i === null ? null : this.bars()[i];
    return b ? ((b.x + b.w / 2) / this.W) * 100 : 0;
  });
  protected tipY = computed(() => {
    const i = this.hover(); const d = i === null ? null : this.data()[i];
    return d ? (this.y(d.value) / this.H) * 100 : 0;
  });

  private y(v: number): number {
    return this.H - this.B - (v / this.max()) * (this.H - this.B - this.T);
  }
}

/** Single-series line over a 0–100 scale (percent trend). */
@Component({
  selector: 'app-trend-chart',
  template: `
    @if (data().length === 0) {
      <p class="empty">{{ emptyText() }}</p>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()"
           (mousemove)="move($event)" (mouseleave)="hover.set(null)">
        @for (g of [0, 50, 100]; track g) {
          <line class="grid" [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="y(g)" [attr.y2]="y(g)" />
          <text class="tick" [attr.x]="L - 8" [attr.y]="y(g) + 3.5" text-anchor="end">{{ g }}%</text>
        }
        <path class="area" [attr.d]="area()" />
        <path class="line" [attr.d]="line()" />
        @if (hover() !== null) {
          <line class="cross" [attr.x1]="pts()[hover()!].x" [attr.x2]="pts()[hover()!].x" [attr.y1]="T" [attr.y2]="H - B" />
        }
        @for (p of pts(); track $index) {
          <circle class="dot" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="hover() === $index ? 5.5 : 4" />
        }
        @if (pts().length) {
          <text class="tick" [attr.x]="pts()[0].x" [attr.y]="H - 6" text-anchor="start">{{ data()[0].label }}</text>
          @if (pts().length > 1) {
            <text class="tick" [attr.x]="pts()[pts().length - 1].x" [attr.y]="H - 6" text-anchor="end">{{ data()[data().length - 1].label }}</text>
          }
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="(pts()[hover()!].x / W) * 100" [style.top.%]="(pts()[hover()!].y / H) * 100">
          <strong>{{ data()[hover()!].label }}</strong>{{ data()[hover()!].tip ?? data()[hover()!].value + '%' }}
        </div>
      }
      <table class="sr-only"><tr><th>Attempt</th><th>Percent</th></tr>
        @for (d of data(); track $index) { <tr><td>{{ d.label }}</td><td>{{ d.value }}%</td></tr> }
      </table>
    }
  `,
  styles: CHART_STYLES,
})
export class TrendChart {
  data = input.required<Datum[]>();
  ariaLabel = input('Trend');
  emptyText = input('No data yet');

  protected readonly W = 640; protected readonly H = 200;
  protected readonly L = 40; protected readonly R = 12; protected readonly T = 12; protected readonly B = 24;
  protected hover = signal<number | null>(null);

  protected pts = computed(() => {
    const n = this.data().length;
    const span = this.W - this.L - this.R;
    return this.data().map((d, i) => ({ x: n === 1 ? this.L + span / 2 : this.L + (i / (n - 1)) * span, y: this.y(d.value) }));
  });
  protected line = computed(() => this.pts().map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
  protected area = computed(() => {
    const p = this.pts();
    if (p.length < 2) return '';
    return `${this.line()} L${p[p.length - 1].x},${this.H - this.B} L${p[0].x},${this.H - this.B} Z`;
  });

  y(v: number): number {
    const c = Math.max(0, Math.min(100, v));
    return this.H - this.B - (c / 100) * (this.H - this.B - this.T);
  }

  move(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.W;
    let best = 0;
    this.pts().forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(this.pts()[best].x - x)) best = i; });
    this.hover.set(best);
  }
}

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Bar path with rounded top corners only, square at the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  r = Math.max(0, r);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}
