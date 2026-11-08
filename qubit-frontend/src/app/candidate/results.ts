import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, formatIst, IstPipe } from '../core/format';
import { CandidateStats, CATEGORY_LABEL, HistoryItem } from '../core/models';
import { Datum, TrendChart } from '../shared/charts';
import { attemptBadge } from '../shared/status';

@Component({
  selector: 'app-results',
  imports: [RouterLink, IstPipe, TrendChart],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Results</h1>
          <p>How your mocks have gone so far, and where the marks are slipping.</p>
        </div>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (stats(); as s) {
        @if (s.attempts === 0) {
          <div class="card empty">
            <h3>No results yet</h3>
            <p>Sit your first assessment and your scores, trend and subject accuracy will build up here.</p>
            <a routerLink="/app/exams" class="btn btn-primary" style="margin-top: 18px">Find an assessment</a>
          </div>
        } @else {
          <section class="tiles">
            <div class="tile"><span class="k">Latest</span><span class="v mono">{{ pct(s.latestPercent) }}</span><span class="s">of max marks</span></div>
            <div class="tile"><span class="k">Average</span><span class="v mono">{{ pct(s.averagePercent) }}</span><span class="s">across {{ s.completed }} completed</span></div>
            <div class="tile"><span class="k">Best</span><span class="v mono">{{ pct(s.bestPercent) }}</span><span class="s">personal best</span></div>
            <div class="tile"><span class="k">Accuracy</span><span class="v mono">{{ pct(s.accuracy) }}</span><span class="s">{{ s.questionsAnswered }} questions answered</span></div>
          </section>

          <div class="grid">
            <section class="card card-pad">
              <h3>Score trend</h3>
              <p class="muted small sub">Percentage of maximum marks, oldest to newest.</p>
              <app-trend-chart [data]="trend()" ariaLabel="Score percentage per attempt" emptyText="Scores appear here once results are released." />
            </section>

            <section class="card card-pad">
              <h3>Accuracy by subject</h3>
              <p class="muted small sub">Correct out of the questions you attempted.</p>
              @for (sub of s.subjects; track sub.subject) {
                <div class="hbar" [title]="sub.correct + ' of ' + sub.attempted + ' correct'">
                  <div class="hbar-top"><span>{{ sub.subject }}</span><span class="mono">{{ sub.accuracy }}%</span></div>
                  <div class="track"><i [style.width.%]="sub.accuracy"></i></div>
                  <div class="hbar-note">{{ sub.correct }} / {{ sub.attempted }} correct</div>
                </div>
              } @empty {
                <p class="muted small">Nothing to show yet.</p>
              }
              @if (weakest(); as w) {
                <p class="tip-note">Weakest area: <strong>{{ w }}</strong>. Start your next revision block there.</p>
              }
            </section>
          </div>

          <section class="card table-wrap">
            <div class="card-head"><h3>All attempts</h3></div>
            <table class="table">
              <thead><tr><th>Assessment</th><th>Finished</th><th>Status</th><th class="num">Score</th><th class="num">%</th><th></th></tr></thead>
              <tbody>
                @for (h of s.history; track h.registrationId) {
                  <tr>
                    <td><div class="title">{{ h.examTitle }}</div><div class="muted small">{{ labels[h.category] }}</div></td>
                    <td class="nowrap small">{{ h.finishedAt | ist }}</td>
                    <td><span [class]="badge(h).cls">{{ badge(h).label }}</span></td>
                    <td class="num mono">@if (h.score !== undefined && h.score !== null) { {{ h.score }} / {{ h.maxScore }} } @else { — }</td>
                    <td class="num mono">{{ h.percent ?? '—' }}</td>
                    <td style="text-align: right"><a [routerLink]="['/app/results', h.registrationId]" class="btn btn-ghost btn-sm">Report</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      } @else if (!error()) {
        <div class="skeleton" style="height: 120px; margin-bottom: 16px"></div>
        <div class="skeleton" style="height: 260px"></div>
      }
    </div>
  `,
  styles: `
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 20px; overflow: hidden; }
    .tile { padding: 18px 20px; display: flex; flex-direction: column; gap: 2px; }
    .tile + .tile { border-left: 1px solid var(--line); }
    .k { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .v { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
    .s { font-size: 12.5px; color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; margin-bottom: 20px; }
    .sub { margin: 2px 0 16px; }
    .hbar { margin-bottom: 14px; }
    .hbar-top { display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 550; }
    .track { height: 8px; background: var(--paper-2); border-radius: 4px; margin-top: 6px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--brand); border-radius: 0 4px 4px 0; }
    .hbar-note { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .tip-note { font-size: 13px; color: var(--ink-2); border-top: 1px solid var(--line); padding-top: 12px; margin-top: 4px; }
    .title { font-weight: 550; }
    @media (max-width: 900px) {
      .tiles { grid-template-columns: repeat(2, 1fr); }
      .tile:nth-child(3) { border-left: 0; }
      .tile:nth-child(n+3) { border-top: 1px solid var(--line); }
      .grid { grid-template-columns: 1fr; }
    }
  `,
})
export class ResultsPage implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected stats = signal<CandidateStats | null>(null);
  protected error = signal<string | null>(null);

  protected trend = computed<Datum[]>(() =>
    (this.stats()?.history ?? [])
      .filter((h) => h.percent !== undefined && h.percent !== null)
      .slice()
      .reverse()
      .map((h) => ({
        label: formatIst(h.finishedAt, 'dateShort'),
        value: h.percent!,
        tip: `${h.examTitle} · ${h.score}/${h.maxScore} (${h.percent}%)`,
      })),
  );

  protected weakest = computed(() => {
    const list = (this.stats()?.subjects ?? []).filter((s) => s.attempted >= 3);
    if (list.length < 2) return null;
    return list.reduce((a, b) => (b.accuracy < a.accuracy ? b : a)).subject;
  });

  ngOnInit(): void {
    this.api.myStats().subscribe({ next: (s) => this.stats.set(s), error: (e) => this.error.set(errorMessage(e)) });
  }

  pct(v?: number | null): string { return v === undefined || v === null ? '—' : `${v}%`; }
  badge(h: HistoryItem) { return attemptBadge(h.status); }
}
