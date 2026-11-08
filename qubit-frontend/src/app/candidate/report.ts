import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe, optionLetter } from '../core/format';
import { AttemptReport, CATEGORY_LABEL, QuestionReview } from '../core/models';
import { attemptBadge } from '../shared/status';
import { MathText } from '../shared/math-text';

type Filter = 'ALL' | 'CORRECT' | 'INCORRECT' | 'UNANSWERED';

@Component({
  selector: 'app-report',
  imports: [RouterLink, IstPipe, MathText],
  template: `
    <div class="page">
      <a routerLink="/app/results" class="back small">← Results</a>
      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (r(); as r) {
        <header class="head">
          <div>
            <p class="eyebrow">{{ labels[r.category] }} · {{ r.examCode }} · <span class="mono">{{ r.hallTicketNo }}</span></p>
            <h1>{{ r.examTitle }}</h1>
            <p class="muted small">Finished {{ r.finishedAt | ist }} · took {{ took(r) }} of {{ r.durationMinutes }} min</p>
          </div>
          <span [class]="badge(r).cls">{{ badge(r).label }}</span>
        </header>

        @if (!r.resultsVisible) {
          <div class="card empty">
            @if (r.status === 'TERMINATED') {
              <h3>This attempt was terminated</h3>
              <p>{{ r.terminationReason }}</p>
            } @else {
              <h3>Results aren't released yet</h3>
              <p>The organiser will publish scores for this assessment later.</p>
            }
          </div>
        } @else {
          <section class="score card">
            <div class="big">
              <span class="eyebrow">Score</span>
              <span class="mono num">{{ r.score }}<small> / {{ r.maxScore }}</small></span>
            </div>
            <dl class="facts">
              <div><dt>Rank</dt><dd class="mono">{{ r.rank }}<small> / {{ r.rankedCandidates }}</small></dd></div>
              <div><dt>Percentile</dt><dd class="mono">{{ r.percentile }}</dd></div>
              <div><dt>Accuracy</dt><dd class="mono">{{ r.accuracy ?? '—' }}{{ r.accuracy !== undefined && r.accuracy !== null ? '%' : '' }}</dd></div>
              <div><dt>Exam average</dt><dd class="mono">{{ r.examAverage }}</dd></div>
              <div><dt>Top score</dt><dd class="mono">{{ r.examTopScore }}</dd></div>
            </dl>
            <div class="split" role="img" [attr.aria-label]="r.correct + ' correct, ' + r.incorrect + ' incorrect, ' + r.unanswered + ' unanswered'">
              <i class="c" [style.flex]="r.correct"></i><i class="w" [style.flex]="r.incorrect"></i><i class="u" [style.flex]="r.unanswered"></i>
            </div>
            <ul class="legend">
              <li><i class="c"></i>{{ r.correct }} correct</li>
              <li><i class="w"></i>{{ r.incorrect }} incorrect</li>
              <li><i class="u"></i>{{ r.unanswered }} unanswered</li>
            </ul>
          </section>

          <section class="card table-wrap">
            <div class="card-head"><h3>By subject</h3></div>
            <table class="table">
              <thead><tr><th>Subject</th><th class="num">Score</th><th style="width: 34%">Share of max</th><th class="num">Correct</th><th class="num">Incorrect</th><th class="num">Skipped</th></tr></thead>
              <tbody>
                @for (s of r.subjects; track s.subject) {
                  <tr>
                    <td class="title">{{ s.subject }}</td>
                    <td class="num mono">{{ s.score }} / {{ s.maxScore }}</td>
                    <td><div class="track" [title]="pct(s.score, s.maxScore) + '%'"><i [style.width.%]="pct(s.score, s.maxScore)"></i></div></td>
                    <td class="num mono">{{ s.correct }}</td>
                    <td class="num mono">{{ s.incorrect }}</td>
                    <td class="num mono">{{ s.unanswered }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section class="review">
            <div class="spread">
              <h2>Question review</h2>
              @if (r.reviewAvailable) {
                <div class="chips">
                  @for (f of filters; track f.key) {
                    <button type="button" class="chip" [class.on]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label }} <span class="mono">{{ count(f.key) }}</span></button>
                  }
                </div>
              }
            </div>
            @if (!r.reviewAvailable) {
              <div class="alert alert-info">
                Answers unlock after every slot of this assessment has finished
                @if (r.reviewAvailableAt) { — around {{ r.reviewAvailableAt | ist }} IST}, so no one sitting later can see them.
              </div>
            } @else {
              <ol class="qs">
                @for (q of visible(); track q.id) {
                  <li [class]="'q ' + q.outcome.toLowerCase()">
                    <div class="q-meta mono">
                      <span>Q{{ q.index }} · {{ q.subject }}</span>
                      <span class="out">{{ outcomeLabel(q) }} · {{ q.awarded > 0 ? '+' : '' }}{{ q.awarded }}</span>
                    </div>
                    <p class="q-text"><app-math [text]="q.text" /></p>
                    @if (q.imageUrl) { <img class="q-fig" [src]="q.imageUrl" alt="Figure for question {{ q.index }}" /> }
                    @if (q.type === 'NUMERIC') {
                      <p class="num-ans">Your answer: <span class="mono">{{ q.yourResponse ?? '—' }}</span> · Correct: <span class="mono ok">{{ q.correctAnswer }}</span></p>
                    } @else {
                      <ul class="opts">
                        @for (o of q.options; track $index) {
                          <li [class.right]="isIn(q.correctAnswer, $index)" [class.mine]="isIn(q.yourResponse, $index)">
                            <b class="mono">{{ letter($index) }}</b><span><app-math [text]="o" /></span>
                            @if (isIn(q.yourResponse, $index)) { <em>your answer</em> }
                          </li>
                        }
                      </ul>
                    }
                  </li>
                } @empty {
                  <p class="muted">No questions in this view.</p>
                }
              </ol>
            }
          </section>
        }
      } @else if (!error()) {
        <div class="skeleton" style="height: 300px; margin-top: 16px"></div>
      }
    </div>
  `,
  styles: `
    .back { color: var(--muted); text-decoration: none; display: inline-block; margin-bottom: 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
    .head h1 { margin: 6px 0 4px; letter-spacing: -0.03em; }
    .score { padding: 24px; margin-bottom: 20px; display: grid; grid-template-columns: auto 1fr; gap: 12px 40px; align-items: center; }
    .big { display: flex; flex-direction: column; }
    .big .num { font-size: 48px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.05; }
    .big small, .facts small { font-size: 16px; color: var(--muted); font-weight: 400; }
    .facts { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 0; }
    .facts dt { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .facts dd { margin: 2px 0 0; font-size: 22px; font-weight: 600; }
    .split { grid-column: 1 / -1; display: flex; gap: 2px; height: 10px; border-radius: 5px; overflow: hidden; background: var(--paper-2); }
    .split i, .legend i { display: block; }
    .c { background: var(--ok); } .w { background: var(--danger); } .u { background: var(--line-strong); }
    .legend { grid-column: 1 / -1; list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; font-size: 13px; color: var(--ink-2); }
    .legend li { display: flex; align-items: center; gap: 6px; }
    .legend i { width: 10px; height: 10px; border-radius: 2px; }
    .title { font-weight: 550; }
    .track { height: 8px; background: var(--paper-2); border-radius: 4px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--brand); border-radius: 0 4px 4px 0; }
    .review { margin-top: 32px; }
    .review h2 { font-size: 22px; }
    .review .alert { margin-top: 14px; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 12.5px; font-weight: 550; cursor: pointer; color: var(--ink-2); }
    .chip span { color: var(--faint); margin-left: 4px; }
    .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .qs { list-style: none; padding: 0; margin: 16px 0 0; border-top: 1px solid var(--ink); }
    .q { padding: 18px 0 18px 16px; border-bottom: 1px solid var(--line); border-left: 3px solid var(--line-strong); }
    .q.correct { border-left-color: var(--ok); }
    .q.incorrect { border-left-color: var(--danger); }
    .q.partial { border-left-color: var(--warn); }
    .q.partial .out { color: var(--warn); }
    .q-fig { max-width: min(560px, 100%); max-height: 320px; border: 1px solid var(--line); border-radius: 8px; padding: 6px; background: #fff; margin-bottom: 10px; }
    .q-meta { display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .q.correct .out { color: var(--ok); } .q.incorrect .out { color: var(--danger); }
    .q-text { margin: 8px 0 10px; white-space: pre-line; max-width: 80ch; }
    .opts { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; max-width: 720px; }
    .opts li { display: flex; gap: 10px; align-items: baseline; padding: 6px 10px; border-radius: 6px; font-size: 14px; }
    .opts b { color: var(--faint); font-size: 12px; }
    .opts li.right { background: var(--ok-soft); color: #145a37; font-weight: 550; }
    .opts li.mine:not(.right) { background: var(--danger-soft); color: #8f2219; }
    .opts em { margin-left: auto; font-style: normal; font-size: 11.5px; font-family: var(--mono); opacity: .8; }
    .num-ans { font-size: 14px; }
    .ok { color: var(--ok); font-weight: 600; }
    @media (max-width: 900px) {
      .score { grid-template-columns: 1fr; }
      .facts { grid-template-columns: repeat(3, 1fr); }
    }
  `,
})
export class ReportPage implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected readonly letter = optionLetter;
  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All' }, { key: 'INCORRECT', label: 'Incorrect' },
    { key: 'UNANSWERED', label: 'Skipped' }, { key: 'CORRECT', label: 'Correct' },
  ];

  id = input.required<string>();
  protected r = signal<AttemptReport | null>(null);
  protected error = signal<string | null>(null);
  protected filter = signal<Filter>('ALL');

  protected visible = computed(() => {
    const f = this.filter();
    const qs = this.r()?.questions ?? [];
    return f === 'ALL' ? qs : qs.filter((q) => q.outcome === f || (f === 'CORRECT' && q.outcome === 'PARTIAL'));
  });

  ngOnInit(): void {
    this.api.report(+this.id()).subscribe({ next: (r) => this.r.set(r), error: (e) => this.error.set(errorMessage(e)) });
  }

  count(f: Filter): number {
    const qs = this.r()?.questions ?? [];
    return f === 'ALL' ? qs.length : qs.filter((q) => q.outcome === f || (f === 'CORRECT' && q.outcome === 'PARTIAL')).length;
  }
  isIn(list: string | undefined | null, i: number): boolean { return !!list && list.split(',').includes(String(i)); }
  pct(a: number, b: number): number { return b > 0 ? Math.max(0, Math.round((100 * a) / b)) : 0; }
  outcomeLabel(q: QuestionReview): string {
    switch (q.outcome) {
      case 'UNANSWERED': return 'Skipped';
      case 'CORRECT': return 'Correct';
      case 'PARTIAL': return 'Partially correct';
      default: return 'Incorrect';
    }
  }
  took(r: AttemptReport): string {
    const m = Math.floor(r.secondsTaken / 60);
    if (m < 1) return 'under a minute';
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  }
  badge(r: AttemptReport) { return attemptBadge(r.status); }
}
