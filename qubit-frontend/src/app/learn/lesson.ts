import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage } from '../core/format';
import { LessonView } from '../core/models';
import { ToastService } from '../core/toast.service';
import { MathText } from '../shared/math-text';
import { VideoPlayer } from '../shared/video-player';
import { LESSON_ICON, LESSON_LABEL, secondsLabel } from './learn-shared';

@Component({
  selector: 'app-lesson',
  imports: [RouterLink, MathText, VideoPlayer],
  template: `
    @if (error()) {
      <div class="page"><div class="alert alert-danger">{{ error() }}</div>
        <a routerLink="/app/learn" class="btn btn-ghost" style="margin-top: 14px">Back to my learning</a></div>
    } @else if (l(); as l) {
      <div class="lesson">
        <div class="main">
          <nav class="crumbs small">
            <a [routerLink]="['/app/courses', l.courseSlug]">{{ l.courseTitle }}</a>
            <span>/</span><span class="muted">{{ l.moduleTitle }}</span>
          </nav>

          @switch (l.type) {
            @case ('VIDEO') {
              <app-video-player [lessonId]="l.id" [poster]="l.posterUrl ?? null" (completed)="onVideoDone()" />
            }
            @case ('DOCUMENT') {
              @if (docUrl()) {
                <div class="doc"><iframe [src]="docUrl()!" title="{{ l.title }}"></iframe></div>
                <p class="muted tiny">This link expires in 15 minutes. Reload the lesson if the document stops loading.</p>
              } @else {
                <div class="card empty"><p>The document is still being processed.</p></div>
              }
            }
            @case ('QUIZ') {
              @if (l.quiz; as q) {
                <div class="quiz card card-pad">
                  <span class="badge badge-brand">{{ q.mode === 'OPEN' ? 'Practice quiz' : 'Proctored test' }}</span>
                  <h2>{{ q.examTitle }}</h2>
                  @if (q.attemptStatus === 'SUBMITTED' || q.attemptStatus === 'AUTO_SUBMITTED' || q.attemptStatus === 'TERMINATED') {
                    <p class="muted">You've already taken this. See how you did.</p>
                    <a class="btn btn-primary" [routerLink]="['/app/results', q.registrationId]">View report</a>
                  } @else if (q.registrationId) {
                    <a class="btn btn-brand" [routerLink]="['/exam', q.registrationId]">{{ q.attemptStatus === 'IN_PROGRESS' ? 'Resume' : 'Open' }} the quiz →</a>
                  } @else {
                    <a class="btn btn-brand" [routerLink]="['/app/exams', q.examId]">Start the quiz →</a>
                  }
                </div>
              }
            }
          }

          <header class="l-head">
            <div>
              <p class="eyebrow">{{ label[l.type] }}@if (l.durationSeconds) { · {{ dur(l.durationSeconds) }} }</p>
              <h1>{{ l.title }}</h1>
            </div>
            <button type="button" class="btn" [class.btn-ghost]="!l.completed" [class.btn-done]="l.completed" (click)="toggleDone()" [disabled]="busy()">
              {{ l.completed ? '✓ Completed' : 'Mark as complete' }}
            </button>
          </header>

          @if (l.body) {
            <article class="body"><app-math [text]="l.body" /></article>
          }

          <div class="pager">
            @if (l.prevLessonId) { <a class="btn btn-ghost" [routerLink]="['/app/learn/lesson', l.prevLessonId]">← Previous</a> } @else { <span></span> }
            @if (l.nextLessonId) { <a class="btn btn-primary" [routerLink]="['/app/learn/lesson', l.nextLessonId]">Next lesson →</a> }
          </div>
        </div>

        <aside class="curr">
          <div class="curr-head">
            <strong>Course content</strong>
            <span class="mono small">{{ l.progressPercent }}%</span>
          </div>
          <div class="track"><i [style.width.%]="l.progressPercent"></i></div>
          @for (m of l.curriculum; track m.id) {
            <div class="cm">
              <p class="cm-title">{{ m.title }}</p>
              <ul>
                @for (x of m.lessons; track x.id) {
                  <li [class.on]="x.id === l.id" [class.locked]="x.locked">
                    @if (x.locked) {
                      <span class="row-l"><svg viewBox="0 0 16 16"><path [attr.d]="icon[x.type]"/></svg><span>{{ x.title }}</span></span>
                    } @else {
                      <a class="row-l" [routerLink]="['/app/learn/lesson', x.id]"><svg viewBox="0 0 16 16"><path [attr.d]="icon[x.type]"/></svg><span>{{ x.title }}</span></a>
                    }
                    @if (x.completed) { <span class="ok">✓</span> } @else if (x.durationSeconds) { <span class="muted tiny mono">{{ dur(x.durationSeconds) }}</span> }
                  </li>
                }
              </ul>
            </div>
          }
        </aside>
      </div>
    } @else {
      <div class="page"><div class="skeleton" style="height: 420px"></div></div>
    }
  `,
  styles: `
    .lesson { display: grid; grid-template-columns: minmax(0, 1fr) 330px; min-height: 100vh; }
    .main { padding: 24px 32px 64px; min-width: 0; }
    .crumbs { display: flex; gap: 8px; margin-bottom: 14px; }
    .crumbs a { text-decoration: none; font-weight: 550; }
    .crumbs a:hover { color: var(--brand); }
    .l-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin: 22px 0 10px; }
    .l-head h1 { font-size: 26px; margin-top: 4px; letter-spacing: -0.025em; }
    .btn-done { background: var(--ok-soft); color: var(--ok); border-color: #c4e3cf; }
    .body { font-size: 16px; line-height: 1.7; max-width: 76ch; color: var(--ink-2); padding: 8px 0 24px; white-space: pre-line; }
    .doc { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; height: min(78vh, 900px); }
    .doc iframe { width: 100%; height: 100%; border: 0; }
    .quiz { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .quiz h2 { font-size: 22px; }
    .pager { display: flex; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 18px; margin-top: 18px; }
    .curr { border-left: 1px solid var(--line); background: #faf9f5; padding: 20px 16px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .curr-head { display: flex; justify-content: space-between; align-items: center; }
    .track { height: 5px; background: var(--paper-2); border-radius: 3px; overflow: hidden; margin: 8px 0 14px; }
    .track i { display: block; height: 100%; background: var(--ok); }
    .cm-title { font-size: 12.5px; font-weight: 600; color: var(--ink); padding: 10px 6px 6px; border-top: 1px solid var(--line); }
    .cm ul { list-style: none; padding: 0; margin: 0 0 6px; }
    .cm li { display: flex; align-items: center; gap: 8px; padding: 2px 0; border-radius: 6px; }
    .row-l { flex: 1; display: flex; align-items: center; gap: 8px; padding: 7px 6px; text-decoration: none; font-size: 13.5px; color: var(--ink-2); min-width: 0; }
    .row-l span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.row-l:hover { color: var(--ink); }
    .cm li.on { background: var(--surface); box-shadow: var(--shadow-1); }
    .cm li.on .row-l { color: var(--ink); font-weight: 600; }
    .cm li.locked .row-l { color: var(--faint); }
    .row-l svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .ok { color: var(--ok); font-weight: 700; padding-right: 6px; }
    .tiny.mono { padding-right: 6px; }
    @media (max-width: 1100px) {
      .lesson { grid-template-columns: 1fr; }
      .curr { position: static; height: auto; border-left: 0; border-top: 1px solid var(--line); }
      .main { padding: 16px; }
    }
  `,
})
export class LessonPage {
  private api = inject(Api);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  protected router = inject(Router);
  protected icon = LESSON_ICON;
  protected label = LESSON_LABEL;
  protected dur = secondsLabel;

  id = input.required<string>();
  protected l = signal<LessonView | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected docUrl = computed<SafeResourceUrl | null>(() => {
    const u = this.l()?.documentUrl;
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u + '#toolbar=0&navpanes=0') : null;
  });

  constructor() {
    effect(() => {
      const id = +this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.l.set(null);
    this.error.set(null);
    this.api.lesson(id).subscribe({ next: (l) => this.l.set(l), error: (e) => this.error.set(errorMessage(e)) });
  }

  toggleDone(): void {
    const l = this.l();
    if (!l) return;
    this.busy.set(true);
    this.api.completeLesson(l.id, !l.completed).subscribe({
      next: (x) => { this.busy.set(false); this.l.set(x); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  onVideoDone(): void {
    const l = this.l();
    if (!l || l.completed) return;
    // The server marks completion from heartbeats; refresh to reflect it.
    setTimeout(() => this.api.lesson(l.id).subscribe({ next: (x) => this.l.set(x) }), 800);
  }
}
