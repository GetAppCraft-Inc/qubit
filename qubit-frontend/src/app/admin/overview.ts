import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { Overview } from '../core/models';

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, IstPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Overview</h1>
          <p>What's scheduled, who's sitting right now, and how papers have gone so far.</p>
        </div>
        <a routerLink="/admin/exams/new" class="btn btn-primary">New exam</a>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (data(); as d) {
        <section class="stats">
          <a routerLink="/admin/live" class="stat live">
            <span class="k">Live now</span>
            <span class="v mono">@if (d.liveAttempts > 0) { <i class="dot dot-live"></i> }{{ d.liveAttempts }}</span>
            <span class="s">attempts in progress</span>
          </a>
          <div class="stat"><span class="k">Exams</span><span class="v mono">{{ d.exams }}</span><span class="s">{{ d.publishedExams }} published</span></div>
          <div class="stat"><span class="k">Candidates</span><span class="v mono">{{ d.candidates }}</span><span class="s">registered accounts</span></div>
          <div class="stat"><span class="k">Registrations</span><span class="v mono">{{ d.registrations }}</span><span class="s">hall tickets issued</span></div>
          <div class="stat"><span class="k">Completed</span><span class="v mono">{{ d.completedAttempts }}</span><span class="s">{{ d.terminatedAttempts }} terminated</span></div>
        </section>

        <section class="card">
          <div class="card-head">
            <h3>Upcoming slots</h3>
            <a routerLink="/admin/exams" class="link small">All exams</a>
          </div>
          @if (d.upcoming.length === 0) {
            <div class="empty">
              <h3>No upcoming slots</h3>
              <p>Publish an exam with at least one future slot and it will appear here.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Starts (IST)</th><th>Exam</th><th>Code</th><th class="num">Booked</th><th>Fill</th></tr></thead>
                <tbody>
                  @for (u of d.upcoming; track $index) {
                    <tr>
                      <td class="nowrap">{{ u.startsAt | ist }}</td>
                      <td><a [routerLink]="['/admin/exams', u.examId]" class="row-link">{{ u.examTitle }}</a></td>
                      <td class="mono small">{{ u.examCode }}</td>
                      <td class="num mono">{{ u.booked }} / {{ u.capacity }}</td>
                      <td style="width: 160px">
                        <div class="bar"><i [style.width.%]="(u.booked / u.capacity) * 100"></i></div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      } @else if (!error()) {
        <div class="skeleton" style="height: 110px; margin-bottom: 20px"></div>
        <div class="skeleton" style="height: 240px"></div>
      }
    </div>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); margin-bottom: 24px; overflow: hidden; }
    .stat { padding: 18px 20px; display: flex; flex-direction: column; gap: 2px; text-decoration: none; }
    .stat + .stat { border-left: 1px solid var(--line); }
    .stat.live:hover { background: #fbfaf7; }
    .k { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .v { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .s { font-size: 12.5px; color: var(--muted); }
    .row-link { text-decoration: none; font-weight: 550; }
    .row-link:hover { color: var(--brand); }
    .bar { height: 6px; background: var(--paper-2); border-radius: 3px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--ink); border-radius: 3px; }
    @media (max-width: 1000px) { .stats { grid-template-columns: repeat(2, 1fr); } .stat + .stat { border-left: 0; } .stat { border-bottom: 1px solid var(--line); } }
  `,
})
export class OverviewPage implements OnInit {
  private api = inject(Api);
  protected data = signal<Overview | null>(null);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.overview().subscribe({ next: (d) => this.data.set(d), error: (e) => this.error.set(errorMessage(e)) });
  }
}
