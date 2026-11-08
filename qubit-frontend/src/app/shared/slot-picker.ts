import { Component, computed, input, model } from '@angular/core';
import { formatIst } from '../core/format';
import { PublicSlot } from '../core/models';

/** Slots grouped by day; single selection. */
@Component({
  selector: 'app-slot-picker',
  template: `
    @for (g of groups(); track g.day) {
      <div class="day">
        <div class="day-label">{{ g.day }}</div>
        <div class="slots">
          @for (s of g.slots; track s.id) {
            <button type="button" class="slot"
                    [class.on]="selected() === s.id"
                    [class.current]="currentId() === s.id"
                    [disabled]="s.seatsLeft <= 0 && currentId() !== s.id"
                    (click)="selected.set(s.id)">
              <span class="time mono">{{ time(s.startsAt) }}</span>
              @if (s.label) { <span class="lbl">{{ s.label }}</span> }
              <span class="seats" [class.low]="s.seatsLeft > 0 && s.seatsLeft <= 10">
                @if (currentId() === s.id) { Your slot }
                @else if (s.seatsLeft <= 0) { Full }
                @else { {{ s.seatsLeft }} seats left }
              </span>
            </button>
          }
        </div>
      </div>
    } @empty {
      <p class="muted">No upcoming slots.</p>
    }
  `,
  styles: `
    .day { display: grid; grid-template-columns: 150px 1fr; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line); }
    .day:first-child { padding-top: 4px; }
    .day-label { font-weight: 600; font-size: 14px; padding-top: 10px; }
    .slots { display: flex; flex-wrap: wrap; gap: 8px; }
    .slot { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 132px; padding: 10px 14px; border-radius: 8px;
      border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; text-align: left; transition: border-color .15s, box-shadow .15s; }
    .slot:hover:not(:disabled) { border-color: var(--ink-2); }
    .slot.on { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); background: var(--brand-soft); }
    .slot:disabled { opacity: .45; cursor: not-allowed; }
    .time { font-size: 16px; font-weight: 600; }
    .lbl { font-size: 12.5px; color: var(--ink-2); }
    .seats { font-size: 12px; color: var(--muted); }
    .seats.low { color: var(--warn); }
    .current .seats { color: var(--brand); font-weight: 550; }
    @media (max-width: 600px) { .day { grid-template-columns: 1fr; gap: 8px; } .day-label { padding-top: 0; } }
  `,
})
export class SlotPicker {
  slots = input.required<PublicSlot[]>();
  currentId = input<number | null>(null);
  selected = model<number | null>(null);

  protected groups = computed(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const s of this.slots()) {
      const day = formatIst(s.startsAt, 'date');
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return [...map.entries()].map(([day, slots]) => ({ day, slots }));
  });

  time(iso: string): string { return formatIst(iso, 'time'); }
}
