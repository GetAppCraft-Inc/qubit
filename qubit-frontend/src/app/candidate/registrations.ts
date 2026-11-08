import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { CATEGORY_LABEL, Registration } from '../core/models';
import { canEnter, nowSignal, registrationBadge } from '../shared/status';

@Component({
  selector: 'app-registrations',
  imports: [RouterLink, IstPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>My registrations</h1>
          <p>Hall tickets, slots and results for every assessment you've signed up for.</p>
        </div>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        <div class="skeleton" style="height: 200px"></div>
      } @else if (items().length === 0) {
        <div class="card empty">
          <h3>No registrations yet</h3>
          <p>Once you register for an assessment, your hall ticket will live here.</p>
          <a routerLink="/app/exams" class="btn btn-primary" style="margin-top: 18px">Browse assessments</a>
        </div>
      } @else {
        <div class="card table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Hall ticket</th>
                <th>Slot (IST)</th>
                <th>Status</th>
                <th class="num">Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of items(); track r.id) {
                <tr>
                  <td>
                    <div class="title">{{ r.exam.title }}</div>
                    <div class="muted small">{{ labels[r.exam.category] }}</div>
                  </td>
                  <td class="mono small">{{ r.hallTicketNo }}</td>
                  <td class="nowrap">{{ r.slot.startsAt | ist }}</td>
                  <td><span [class]="badge(r).cls">{{ badge(r).label }}</span></td>
                  <td class="num mono">
                    @if (r.attempt?.resultsVisible) { {{ r.attempt?.score }} / {{ r.attempt?.maxScore }} } @else { — }
                  </td>
                  <td class="actions">
                    @if (enterable(r)) {
                      <a [routerLink]="['/exam', r.id]" class="btn btn-brand btn-sm">Enter</a>
                    }
                    <a [routerLink]="['/app/registrations', r.id]" class="btn btn-ghost btn-sm">Hall ticket</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .title { font-weight: 550; }
    .actions { text-align: right; white-space: nowrap; }
    .actions .btn + .btn { margin-left: 6px; }
  `,
})
export class RegistrationsPage implements OnInit {
  private api = inject(Api);
  protected labels = CATEGORY_LABEL;
  protected now = nowSignal(5000);
  protected items = signal<Registration[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.registrations().subscribe({
      next: (r) => { this.items.set(r.slice().sort((a, b) => Date.parse(b.slot.startsAt) - Date.parse(a.slot.startsAt))); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  badge(r: Registration) { return registrationBadge(r, this.now()); }
  enterable(r: Registration) { return canEnter(r, this.now()); }
}
