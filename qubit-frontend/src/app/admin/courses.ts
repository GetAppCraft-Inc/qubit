import { Component, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, CourseSummary } from '../core/models';
import { secondsLabel } from '../learn/learn-shared';

@Component({
  selector: 'app-admin-courses',
  imports: [RouterLink, IstPipe, TitleCasePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Courses</h1>
          <p>Build courses from modules and lessons — encrypted videos, PDF notes, readings and quizzes.</p>
        </div>
        <div class="row">
          <a routerLink="/admin/media" class="btn btn-ghost">Media library</a>
          <a routerLink="/admin/courses/new" class="btn btn-primary">New course</a>
        </div>
      </div>
      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
      @if (loading()) {
        <div class="skeleton" style="height: 200px"></div>
      } @else if (list().length === 0) {
        <div class="card empty">
          <h3>No courses yet</h3>
          <p>Upload a few lecture videos to the media library, then create a course and add them as lessons.</p>
          <a routerLink="/admin/courses/new" class="btn btn-primary" style="margin-top: 18px">Create a course</a>
        </div>
      } @else {
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>Course</th><th>Status</th><th class="num">Modules</th><th class="num">Lessons</th><th>Video</th><th class="num">Learners</th><th>Created</th></tr></thead>
            <tbody>
              @for (c of list(); track c.id) {
                <tr class="clickable" [routerLink]="['/admin/courses', c.id]">
                  <td><div class="title">{{ c.title }}</div><div class="muted small mono">{{ c.slug }} · {{ labels[c.category] }}</div></td>
                  <td><span [class]="c.status === 'PUBLISHED' ? 'badge badge-ok' : c.status === 'ARCHIVED' ? 'badge badge-warn' : 'badge'">{{ c.status | titlecase }}</span></td>
                  <td class="num mono">{{ c.moduleCount }}</td>
                  <td class="num mono">{{ c.lessonCount }}</td>
                  <td class="small">{{ dur(c.totalDurationSeconds) || '—' }}</td>
                  <td class="num mono">{{ c.enrollments }}</td>
                  <td class="small nowrap">{{ c.createdAt | ist: 'dateShort' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `.clickable { cursor: pointer; } .clickable:hover .title { color: var(--brand); } .title { font-weight: 550; }`,
})
export class AdminCourses implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected list = signal<CourseSummary[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected dur = secondsLabel;

  ngOnInit(): void {
    this.api.adminCourses().subscribe({
      next: (l) => { this.list.set(l); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
