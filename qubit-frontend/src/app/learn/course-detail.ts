import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, CourseDetail, CurriculumLesson } from '../core/models';
import { ToastService } from '../core/toast.service';
import { MathText } from '../shared/math-text';
import { CourseCover, LESSON_ICON, LESSON_LABEL, secondsLabel } from './learn-shared';

@Component({
  selector: 'app-course-detail',
  imports: [RouterLink, IstPipe, MathText, CourseCover],
  template: `
    <div class="page">
      <a routerLink="/app/courses" class="back small">← Courses</a>
      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (d(); as d) {
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">{{ labels[d.course.category] }}</p>
            <h1>{{ d.course.title }}</h1>
            @if (d.course.subtitle) { <p class="sub">{{ d.course.subtitle }}</p> }
            <dl class="facts">
              <div><dt>Lessons</dt><dd>{{ d.course.lessonCount }}</dd></div>
              <div><dt>Video</dt><dd>{{ dur(d.course.totalDurationSeconds) || '—' }}</dd></div>
              <div><dt>Access</dt><dd>{{ d.validityDays ? d.validityDays + ' days' : 'Lifetime' }}</dd></div>
              <div><dt>Quality</dt><dd>Up to 4K</dd></div>
            </dl>
            <div class="cta">
              @if (active()) {
                <a class="btn btn-primary btn-lg" [routerLink]="['/app/learn/lesson', d.nextLessonId]">
                  {{ (d.course.progressPercent ?? 0) > 0 ? 'Continue learning' : 'Start course' }} →
                </a>
                <span class="muted small">{{ d.course.progressPercent ?? 0 }}% complete
                  @if (d.enrollment?.expiresAt) { · access until {{ d.enrollment!.expiresAt | ist: 'date' }} }</span>
              } @else if (d.enrollment && !d.enrollment.active) {
                <div class="alert alert-warn">Your access to this course has ended.</div>
              } @else {
                <button class="btn btn-brand btn-lg" type="button" (click)="enroll()" [disabled]="busy()">
                  @if (busy()) { <span class="spinner"></span> } Enroll for free
                </button>
                <span class="muted small">Instant access · progress saved to your account</span>
              }
            </div>
          </div>
          <app-course-cover class="cover" [course]="d.course" />
        </section>

        <div class="layout">
          <section>
            <h2>Curriculum</h2>
            @for (m of d.modules; track m.id; let mi = $index) {
              <div class="module">
                <div class="m-head"><span class="mono">{{ mi + 1 < 10 ? '0' + (mi + 1) : mi + 1 }}</span><h3>{{ m.title }}</h3><span class="muted small">{{ m.lessons.length }} lessons</span></div>
                <ul>
                  @for (l of m.lessons; track l.id) {
                    <li [class.locked]="l.locked">
                      <svg viewBox="0 0 16 16" class="ic"><path [attr.d]="icon[l.type]"/></svg>
                      @if (!l.locked) {
                        <a [routerLink]="['/app/learn/lesson', l.id]">{{ l.title }}</a>
                      } @else {
                        <span>{{ l.title }}</span>
                      }
                      @if (l.freePreview && !active()) { <span class="badge badge-brand">Preview</span> }
                      <span class="grow"></span>
                      <span class="muted small">{{ lessonMeta(l) }}</span>
                      @if (l.completed) { <span class="done" title="Completed">✓</span> }
                      @else if (l.locked) { <svg viewBox="0 0 16 16" class="lock"><rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg> }
                    </li>
                  }
                </ul>
              </div>
            } @empty {
              <p class="muted">Lessons are being added.</p>
            }
          </section>
          <aside class="about card card-pad">
            <h3>About this course</h3>
            @if (d.description) { <p class="desc"><app-math [text]="d.description" /></p> } @else { <p class="muted small">No description yet.</p> }
            <h3 class="mt">How lessons are protected</h3>
            <ul class="small muted">
              <li>Videos are encrypted and stream only to your signed-in account.</li>
              <li>Up to 2 devices can play at the same time.</li>
              <li>Your name appears as a watermark on every video.</li>
            </ul>
          </aside>
        </div>
      } @else if (!error()) {
        <div class="skeleton" style="height: 300px; margin-top: 12px"></div>
      }
    </div>
  `,
  styles: `
    .back { color: var(--muted); text-decoration: none; display: inline-block; margin-bottom: 16px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 36px; align-items: center; margin-bottom: 40px; }
    .hero h1 { font-size: clamp(30px, 3.6vw, 44px); letter-spacing: -0.035em; margin: 8px 0 8px; }
    .sub { font-size: 17px; color: var(--ink-2); }
    .facts { display: grid; grid-template-columns: repeat(4, 1fr); margin: 24px 0; border-top: 1px solid var(--ink); }
    .facts div { padding: 12px 12px 0 0; }
    .facts dt { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .facts dd { margin: 3px 0 0; font-weight: 600; font-size: 16px; }
    .cta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .cover { border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-2); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 36px; align-items: start; }
    h2 { font-size: 22px; margin-bottom: 14px; }
    .module { border-top: 1px solid var(--ink); padding: 14px 0 6px; }
    .m-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; }
    .m-head .mono { color: var(--brand); font-size: 12px; font-weight: 600; }
    .m-head h3 { flex: 1; font-size: 16px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--line); font-size: 14.5px; }
    li a { text-decoration: none; font-weight: 520; }
    li a:hover { color: var(--brand); }
    li.locked span:not(.badge):not(.muted) { color: var(--muted); }
    .ic, .lock { width: 16px; height: 16px; fill: none; stroke: var(--muted); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .grow { flex: 1; }
    .done { color: var(--ok); font-weight: 700; }
    .about h3 { font-size: 14px; }
    .about .mt { margin-top: 18px; }
    .desc { font-size: 14px; color: var(--ink-2); margin-top: 8px; white-space: pre-line; }
    .about ul li { border: 0; padding: 4px 0; display: list-item; list-style: disc; margin-left: 16px; }
    @media (max-width: 900px) { .hero, .layout { grid-template-columns: 1fr; } .facts { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class CourseDetailPage implements OnInit {
  private api = inject(Api);
  private toast = inject(ToastService);
  private router = inject(Router);
  protected labels = CATEGORY_LABEL;
  protected icon = LESSON_ICON;
  protected dur = secondsLabel;

  slug = input.required<string>();
  protected d = signal<CourseDetail | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected active = computed(() => !!this.d()?.enrollment?.active);

  ngOnInit(): void {
    this.api.course(this.slug()).subscribe({ next: (d) => this.d.set(d), error: (e) => this.error.set(errorMessage(e)) });
  }

  enroll(): void {
    this.busy.set(true);
    this.api.enroll(this.slug()).subscribe({
      next: (d) => {
        this.busy.set(false);
        this.d.set(d);
        this.toast.ok('You’re enrolled. Enjoy the course!');
        if (d.nextLessonId) this.router.navigate(['/app/learn/lesson', d.nextLessonId]);
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  lessonMeta(l: CurriculumLesson): string {
    return l.durationSeconds ? secondsLabel(l.durationSeconds) : LESSON_LABEL[l.type];
  }
}
