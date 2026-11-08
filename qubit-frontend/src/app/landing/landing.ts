import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { clock } from '../core/format';
import { Logo } from '../shared/logo';

type Cell = 'answered' | 'review' | 'answered-review' | 'skipped' | 'fresh' | 'current';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Logo],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnDestroy {
  protected auth = inject(AuthService);

  /** The mock timer in the hero ticks down for real. */
  private readonly remainingMs = signal((2 * 3600 + 41 * 60 + 56) * 1000);
  protected readonly timer = computed(() => clock(this.remainingMs()));
  private readonly tick = setInterval(() => this.remainingMs.update((v) => (v > 1000 ? v - 1000 : 3 * 3600 * 1000)), 1000);

  protected readonly palette: Cell[] = [
    'answered', 'answered', 'skipped', 'answered', 'review', 'answered', 'answered', 'answered-review',
    'answered', 'skipped', 'answered', 'answered', 'answered', 'current', 'fresh', 'fresh',
    'fresh', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh',
  ];

  protected readonly formats = [
    { name: 'JEE Main', paper: 'Paper 1 · B.E./B.Tech', duration: '3 h', questions: '75', marking: '+4 / −1', subjects: 'Physics, Chemistry, Mathematics' },
    { name: 'NEET-UG', paper: 'Single paper', duration: '3 h', questions: '180', marking: '+4 / −1', subjects: 'Physics, Chemistry, Botany, Zoology' },
    { name: 'BITSAT', paper: 'Computer-based', duration: '3 h', questions: '130', marking: '+3 / −1', subjects: 'Physics, Chemistry, Maths, English & LR' },
    { name: 'Your format', paper: 'Set by your institute', duration: 'Any', questions: 'Any', marking: 'Per question', subjects: 'Single, multi-correct & numeric' },
  ];

  protected readonly log = [
    { t: '10:00:04', ticket: 'QB26JM7K4PX2Q9', what: 'Attempt started', tag: '', tone: '' },
    { t: '10:31:47', ticket: 'QB26JM3HTR8W2M', what: 'Paste blocked', tag: 'logged', tone: 'muted' },
    { t: '10:52:13', ticket: 'QB26JM9QZC4N7L', what: 'Left full screen', tag: '1 / 1', tone: 'warn' },
    { t: '10:52:13', ticket: 'QB26JM9QZC4N7L', what: 'Attempt terminated', tag: 'closed', tone: 'danger' },
    { t: '11:14:30', ticket: 'QB26JM5BV2D8RX', what: 'Connection restored', tag: '6 s', tone: 'muted' },
    { t: '12:58:40', ticket: 'QB26JM7K4PX2Q9', what: 'Submitted', tag: '212 / 300', tone: 'ok' },
  ];

  protected readonly year = new Date().getFullYear();

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }
}
