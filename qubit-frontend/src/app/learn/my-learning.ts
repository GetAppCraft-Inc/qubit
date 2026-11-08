import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, MyCourse } from '../core/models';
import { CourseCover } from './learn-shared';

@Component({
  selector: 'app-my-learning',
  imports: [RouterLink, IstPipe, CourseCover],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>My learning</h1>
          <p>Pick up exactly where you left off.</p>
        </div>
        <a routerLink="/app/courses" class="btn btn-ghost">Browse courses</a>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        <div class="skeleton" style="height: 160px"></div>
      } @else if (items().length === 0) {
        <div class="card empty">
          <h3>You haven't started a course yet</h3>
          <p>Enroll in a course and it will appear here with your progress.</p>
          <a routerLink="/app/courses" class="btn btn-primary" style="margin-top: 18px">Find a course</a>
        </div>
      } @else {
        <ul class="list">
          @for (m of items(); track m.course.id) {
            <li class="card">
              <app-course-cover class="thumb" [course]="m.course" />
              <div class="info">
                <p class="eyebrow">{{ labels[m.course.category] }}</p>
                <h3><a [routerLink]="['/app/courses', m.course.slug]">{{ m.course.title }}</a></h3>
                <div class="prog">
                  <div class="track"><i [style.width.%]="m.course.progressPercent ?? 0"></i></div>
                  <span class="mono small">{{ m.completedLessons }}/{{ m.course.lessonCount }} · {{ m.course.progressPercent ?? 0 }}%</span>
                </div>
                <p class="muted small">
                  @if (m.lastAccessedAt) { Last opened {{ m.lastAccessedAt | ist }} } @else { Enrolled {{ m.enrolledAt | ist: 'date' }} }
                  @if (m.expiresAt) { · access until {{ m.expiresAt | ist: 'date' }} }
                </p>
              </div>
              <div class="act">
                @if (m.nextLessonId) {
                  <a class="btn btn-primary" [routerLink]="['/app/learn/lesson', m.nextLessonId]">{{ (m.course.progressPercent ?? 0) > 0 ? 'Continue' : 'Start' }} →</a>
                  @if (m.nextLessonTitle) { <span class="muted tiny next">Next: {{ m.nextLessonTitle }}</span> }
                } @else {
                  <span class="badge">Access ended</span>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
    .list li { display: grid; grid-template-columns: 220px minmax(0, 1fr) auto; gap: 20px; align-items: center; overflow: hidden; padding-right: 20px; }
    .thumb { height: 100%; }
    .info { padding: 16px 0; display: flex; flex-direction: column; gap: 6px; }
    h3 a { text-decoration: none; }
    h3 a:hover { color: var(--brand); }
    .prog { display: flex; align-items: center; gap: 10px; max-width: 420px; }
    .track { flex: 1; height: 7px; background: var(--paper-2); border-radius: 4px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--ok); }
    .act { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .next { max-width: 200px; text-align: right; }
    @media (max-width: 760px) { .list li { grid-template-columns: 1fr; padding: 0 0 16px; } .info, .act { padding: 0 16px; } .act { align-items: flex-start; } }
  `,
})
export class MyLearningPage implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected items = signal<MyCourse[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.myCourses().subscribe({
      next: (l) => { this.items.set(l); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
