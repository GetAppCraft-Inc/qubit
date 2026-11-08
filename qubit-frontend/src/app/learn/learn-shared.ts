import { Component, input } from '@angular/core';
import { CATEGORY_LABEL, CourseCard, LessonType } from '../core/models';

export function secondsLabel(s?: number | null): string {
  if (!s) return '';
  const m = Math.round(s / 60);
  if (m < 1) return `${s}s`;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export const LESSON_ICON: Record<LessonType, string> = {
  VIDEO: 'M5 4.5v7l6-3.5z',
  DOCUMENT: 'M4 1.5h5.5L12 4v10.5H4zM9.5 1.5V4H12M6 7.5h4M6 10h4',
  ARTICLE: 'M3 3.5h10M3 6.5h10M3 9.5h10M3 12.5h6',
  QUIZ: 'M5.5 6a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V10.5M8 13v.01',
};

export const LESSON_LABEL: Record<LessonType, string> = { VIDEO: 'Video', DOCUMENT: 'Notes (PDF)', ARTICLE: 'Reading', QUIZ: 'Quiz' };

/** Course cover: the uploaded image, or a typographic placeholder built from the title. */
@Component({
  selector: 'app-course-cover',
  template: `
    @if (course().coverImage) {
      <img [src]="course().coverImage" alt="" />
    } @else {
      <div class="ph" [attr.data-tone]="tone()">
        <span class="cat mono">{{ labels[course().category] }}</span>
        <span class="t">{{ course().title }}</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; aspect-ratio: 16 / 9; overflow: hidden; background: var(--paper-2); }
    img { width: 100%; height: 100%; object-fit: cover; }
    .ph { width: 100%; height: 100%; padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between;
      background: var(--ink); color: #fff; background-image: repeating-linear-gradient(135deg, transparent 0 9px, rgba(255,255,255,.04) 9px 10px); }
    .ph[data-tone="1"] { background-color: #23108c; }
    .ph[data-tone="2"] { background-color: #1d3b2f; }
    .ph[data-tone="3"] { background-color: #3a2410; }
    .cat { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.65); }
    .t { font-size: 19px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.15; max-width: 16ch; }
  `,
})
export class CourseCover {
  course = input.required<CourseCard>();
  protected labels = CATEGORY_LABEL;
  tone(): number { return (this.course().id ?? 0) % 4; }
}
