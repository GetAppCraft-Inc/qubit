import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage } from '../core/format';
import { CATEGORY_LABEL, CourseCard, ExamCategory } from '../core/models';
import { CourseCover, secondsLabel } from './learn-shared';

@Component({
  selector: 'app-courses',
  imports: [RouterLink, CourseCover],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Courses</h1>
          <p>Recorded lessons, notes and practice quizzes — streamed in up to 4K and kept to your account.</p>
        </div>
        <input class="input search" type="search" placeholder="Search courses" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>

      <div class="filters">
        <button type="button" class="chip" [class.on]="cat() === 'ALL'" (click)="cat.set('ALL')">All</button>
        @for (c of categories(); track c) {
          <button type="button" class="chip" [class.on]="cat() === c" (click)="cat.set(c)">{{ labels[c] }}</button>
        }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        <div class="grid">@for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height: 280px"></div> }</div>
      } @else if (visible().length === 0) {
        <div class="card empty"><h3>No courses yet</h3><p>New courses are on the way. Meanwhile, try a mock test.</p></div>
      } @else {
        <div class="grid">
          @for (c of visible(); track c.id) {
            <a class="course card" [routerLink]="['/app/courses', c.slug]">
              <app-course-cover [course]="c" />
              <div class="body">
                <p class="eyebrow">{{ labels[c.category] }}</p>
                <h3>{{ c.title }}</h3>
                @if (c.subtitle) { <p class="sub">{{ c.subtitle }}</p> }
                <p class="meta">{{ c.lessonCount }} lessons@if (c.totalDurationSeconds) { · {{ dur(c.totalDurationSeconds) }} of video }</p>
                @if (c.enrolled) {
                  <div class="prog"><div class="track"><i [style.width.%]="c.progressPercent ?? 0"></i></div><span class="mono">{{ c.progressPercent ?? 0 }}%</span></div>
                }
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .search { width: 260px; }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
    .chip { height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 13px; font-weight: 550; color: var(--ink-2); cursor: pointer; }
    .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 18px; }
    .course { overflow: hidden; text-decoration: none; display: flex; flex-direction: column; transition: box-shadow .15s, transform .15s; }
    .course:hover { box-shadow: var(--shadow-2); transform: translateY(-2px); }
    .body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
    h3 { font-size: 16.5px; }
    .sub { font-size: 13.5px; color: var(--ink-2); }
    .meta { font-size: 12.5px; color: var(--muted); margin-top: auto; padding-top: 8px; }
    .prog { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; }
    .track { flex: 1; height: 6px; background: var(--paper-2); border-radius: 3px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--ok); }
    @media (max-width: 600px) { .search { width: 100%; } }
  `,
})
export class CoursesPage implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected list = signal<CourseCard[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected q = signal('');
  protected cat = signal<ExamCategory | 'ALL'>('ALL');
  protected categories = computed(() => [...new Set(this.list().map((c) => c.category))]);
  protected visible = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.list().filter((c) => (this.cat() === 'ALL' || c.category === this.cat())
      && (!q || c.title.toLowerCase().includes(q) || (c.subtitle ?? '').toLowerCase().includes(q)));
  });
  protected dur = secondsLabel;

  ngOnInit(): void {
    this.api.courses().subscribe({
      next: (l) => { this.list.set(l); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
