import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DurationPipe, errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, ExamSummary } from '../core/models';
import { examStatusBadge } from '../shared/status';

@Component({
  selector: 'app-admin-exams',
  imports: [RouterLink, IstPipe, DurationPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Exams</h1>
          <p>Create papers, schedule slots and publish when ready. Questions lock once the first candidate begins.</p>
        </div>
        <a routerLink="/admin/exams/new" class="btn btn-primary">New exam</a>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        <div class="skeleton" style="height: 240px"></div>
      } @else if (exams().length === 0) {
        <div class="card empty">
          <h3>No exams yet</h3>
          <p>Start with the details — title, duration and rules — then add questions and slots.</p>
          <a routerLink="/admin/exams/new" class="btn btn-primary" style="margin-top: 18px">Create the first exam</a>
        </div>
      } @else {
        <div class="card table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Exam</th><th>Status</th><th>Format</th>
                <th class="num">Questions</th><th class="num">Slots</th><th class="num">Registered</th><th>Next slot</th>
              </tr>
            </thead>
            <tbody>
              @for (e of exams(); track e.id) {
                <tr class="clickable" [routerLink]="['/admin/exams', e.id]">
                  <td>
                    <div class="title">{{ e.title }}</div>
                    <div class="muted small mono">{{ e.code }} · {{ labels[e.category] }}</div>
                  </td>
                  <td>
                    <span [class]="badge(e).cls">{{ badge(e).label }}</span>
                    @if (e.mode === 'OPEN') { <span class="badge" style="margin-left: 4px">Open quiz</span> }
                  </td>
                  <td class="small nowrap">{{ e.durationMinutes | duration }} · {{ e.totalMarks }} marks</td>
                  <td class="num mono">{{ e.questionCount }}</td>
                  <td class="num mono">{{ e.slotCount }}</td>
                  <td class="num mono">{{ e.registrationCount }}</td>
                  <td class="small nowrap">{{ e.nextSlotAt | ist }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .clickable { cursor: pointer; }
    .clickable:hover .title { color: var(--brand); }
    .title { font-weight: 550; }
  `,
})
export class AdminExams implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected exams = signal<ExamSummary[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.adminExams().subscribe({
      next: (list) => { this.exams.set(list); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  badge(e: ExamSummary) { return examStatusBadge(e.status); }
}
