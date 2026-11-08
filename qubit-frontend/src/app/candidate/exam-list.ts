import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DurationPipe, errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, ExamCategory, PublicExam } from '../core/models';

@Component({
  selector: 'app-exam-list',
  imports: [RouterLink, IstPipe, DurationPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Assessments</h1>
          <p>Every paper runs in scheduled slots. Register, pick a time that suits you, and your hall ticket is ready instantly.</p>
        </div>
      </div>

      <div class="filters" role="tablist" aria-label="Filter by exam">
        <button type="button" class="chip" [class.on]="filter() === 'ALL'" (click)="filter.set('ALL')">All</button>
        @for (c of categories(); track c) {
          <button type="button" class="chip" [class.on]="filter() === c" (click)="filter.set(c)">{{ labels[c] }}</button>
        }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height: 92px; margin-bottom: 10px"></div> }
      } @else if (visible().length === 0) {
        <div class="card empty">
          <h3>No assessments open right now</h3>
          <p>New mocks are published regularly. We'll have something for you soon.</p>
        </div>
      } @else {
        <ul class="exams">
          @for (e of visible(); track e.id) {
            <li>
              <a [routerLink]="['/app/exams', e.id]" class="exam">
                <div class="cat mono">{{ labels[e.category] }}@if (e.mode === 'OPEN') {<span class="open">Open quiz</span>}</div>
                <div class="body">
                  <h3>{{ e.title }}</h3>
                  <p class="meta">
                    <span>{{ e.durationMinutes | duration }}</span>
                    <span>{{ e.questionCount }} questions</span>
                    <span>{{ e.totalMarks }} marks</span>
                    @if (e.subjects.length) { <span>{{ e.subjects.join(' · ') }}</span> }
                  </p>
                </div>
                <div class="side">
                  @if (e.myRegistrationId) {
                    <span class="badge badge-ok">Registered</span>
                  } @else if (e.registrationOpen && e.mode === 'OPEN') {
                    <span class="next-slot">Take it any time<br /><strong>{{ e.registrationClosesAt ? 'until ' + (e.registrationClosesAt | ist) : 'no deadline' }}</strong></span>
                  } @else if (e.registrationOpen) {
                    <span class="next-slot">Next slot<br /><strong>{{ e.nextSlotAt | ist }}</strong></span>
                  } @else {
                    <span class="badge">Registration closed</span>
                  }
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
    .chip { height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 13px; font-weight: 550; color: var(--ink-2); cursor: pointer; }
    .chip:hover { border-color: var(--ink-2); }
    .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .exams { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ink); }
    .exam { display: grid; grid-template-columns: 130px 1fr auto; gap: 24px; align-items: center; padding: 22px 4px; border-bottom: 1px solid var(--line); text-decoration: none; transition: background .15s; }
    .exam:hover { background: rgba(255, 255, 255, .6); }
    .exam:hover h3 { color: var(--brand); }
    .cat { font-size: 11.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--brand); display: flex; flex-direction: column; gap: 4px; }
    .open { color: var(--ok); font-size: 10.5px; }
    h3 { font-size: 18px; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13.5px; color: var(--muted); margin-top: 4px; }
    .side { text-align: right; }
    .next-slot { font-size: 12.5px; color: var(--muted); line-height: 1.4; }
    .next-slot strong { color: var(--ink); font-weight: 550; font-size: 13.5px; }
    @media (max-width: 720px) {
      .exam { grid-template-columns: 1fr; gap: 8px; }
      .side { text-align: left; }
    }
  `,
})
export class ExamList implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected exams = signal<PublicExam[]>([]);
  protected filter = signal<ExamCategory | 'ALL'>('ALL');

  protected categories = computed(() => [...new Set(this.exams().map((e) => e.category))]);
  protected visible = computed(() => {
    const f = this.filter();
    return f === 'ALL' ? this.exams() : this.exams().filter((e) => e.category === f);
  });

  ngOnInit(): void {
    this.api.exams().subscribe({
      next: (list) => { this.exams.set(list); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
