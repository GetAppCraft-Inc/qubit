import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { DurationPipe, errorMessage, IstPipe, until } from '../core/format';
import { CATEGORY_LABEL, PublicExam, Registration } from '../core/models';
import { canEnter, nowSignal, registrationBadge } from '../shared/status';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, IstPipe, DurationPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <p class="eyebrow">{{ now() | ist: 'date' }}</p>
          <h1>{{ greeting() }}, {{ firstName() }}.</h1>
        </div>
        <a routerLink="/app/exams" class="btn btn-ghost">Browse assessments</a>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading()) {
        <div class="skeleton" style="height: 180px"></div>
      } @else {
        <!-- next up -->
        @if (next(); as r) {
          <section class="next card">
            <div class="next-main">
              <p class="eyebrow">Up next</p>
              <h2>{{ r.exam.title }}</h2>
              <p class="muted">
                {{ labels[r.exam.category] }} · {{ r.exam.durationMinutes | duration }} · {{ r.exam.questionCount }} questions ·
                <span class="mono">{{ r.hallTicketNo }}</span>
              </p>
              <div class="next-actions">
                @if (enterable(r)) {
                  <a [routerLink]="['/exam', r.id]" class="btn btn-brand btn-lg">
                    {{ r.attempt ? 'Return to exam' : 'Enter exam hall' }} <span aria-hidden="true">→</span>
                  </a>
                } @else {
                  <button class="btn btn-primary btn-lg" disabled>Opens {{ untilOpen(r) }}</button>
                }
                <a [routerLink]="['/app/registrations', r.id]" class="btn btn-ghost btn-lg">Hall ticket</a>
              </div>
            </div>
            <div class="next-when">
              <div class="when-day">{{ r.slot.startsAt | ist: 'dateShort' }}</div>
              <div class="when-time mono">{{ r.slot.startsAt | ist: 'time' }}</div>
              <div class="when-note">Entry closes {{ r.entryClosesAt | ist: 'time' }} IST</div>
            </div>
          </section>
        } @else {
          <section class="card empty">
            <h3>Nothing scheduled yet</h3>
            <p>Register for an assessment and pick a slot — it will show up here with a countdown.</p>
            <a routerLink="/app/exams" class="btn btn-primary" style="margin-top: 18px">See what's open</a>
          </section>
        }

        <div class="cols">
          <section>
            <div class="spread sec-head">
              <h3>Your registrations</h3>
              <a routerLink="/app/registrations" class="link small">View all</a>
            </div>
            @if (registrations().length === 0) {
              <p class="muted small">No registrations yet.</p>
            }
            <ul class="list">
              @for (r of registrations().slice(0, 5); track r.id) {
                <li>
                  <a [routerLink]="['/app/registrations', r.id]">
                    <div class="grow">
                      <div class="title">{{ r.exam.title }}</div>
                      <div class="meta">{{ r.slot.startsAt | ist }}</div>
                    </div>
                    @if (r.attempt?.resultsVisible) {
                      <span class="score mono">{{ r.attempt?.score }}<small>/{{ r.attempt?.maxScore }}</small></span>
                    }
                    <span [class]="badge(r).cls">{{ badge(r).label }}</span>
                  </a>
                </li>
              }
            </ul>
          </section>

          <section>
            <div class="spread sec-head">
              <h3>Open for registration</h3>
              <a routerLink="/app/exams" class="link small">All assessments</a>
            </div>
            @if (openExams().length === 0) {
              <p class="muted small">Nothing new right now. Check back soon.</p>
            }
            <ul class="list">
              @for (e of openExams().slice(0, 5); track e.id) {
                <li>
                  <a [routerLink]="['/app/exams', e.id]">
                    <div class="grow">
                      <div class="title">{{ e.title }}</div>
                      <div class="meta">{{ labels[e.category] }} · {{ e.durationMinutes | duration }} · next slot {{ e.nextSlotAt | ist: 'dateShort' }}</div>
                    </div>
                    <span class="arrow" aria-hidden="true">→</span>
                  </a>
                </li>
              }
            </ul>
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .next { display: grid; grid-template-columns: 1fr auto; overflow: hidden; }
    .next-main { padding: 28px; }
    .next h2 { font-size: 26px; margin: 8px 0 6px; letter-spacing: -0.025em; }
    .next-actions { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
    .next-when { background: var(--ink); color: #fff; padding: 28px 32px; display: flex; flex-direction: column; justify-content: center; min-width: 220px; }
    .when-day { font-size: 14px; color: #b8b6c0; }
    .when-time { font-size: 36px; font-weight: 600; letter-spacing: -0.02em; margin: 2px 0 8px; }
    .when-note { font-size: 12.5px; color: #8d8a97; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; }
    .sec-head { padding-bottom: 10px; border-bottom: 1px solid var(--ink); }
    .list { list-style: none; padding: 0; margin: 0; }
    .list li a { display: flex; align-items: center; gap: 12px; padding: 14px 2px; border-bottom: 1px solid var(--line); text-decoration: none; }
    .list li a:hover .title { color: var(--brand); }
    .title { font-weight: 550; }
    .meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
    .score { font-weight: 600; }
    .score small { color: var(--muted); font-weight: 400; }
    .arrow { color: var(--faint); }
    @media (max-width: 760px) {
      .next { grid-template-columns: 1fr; }
      .next-main { padding: 22px; }
      .cols { grid-template-columns: 1fr; }
    }
  `,
})
export class Dashboard implements OnInit {
  private api = inject(Api);
  private auth = inject(AuthService);
  protected labels = CATEGORY_LABEL;
  protected now = nowSignal();

  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected registrations = signal<Registration[]>([]);
  protected exams = signal<PublicExam[]>([]);

  protected firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0] || 'there');
  protected greeting = computed(() => {
    const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(this.now()));
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  protected next = computed(() => {
    const now = this.now();
    return this.registrations()
      .filter((r) => r.attempt?.status === 'IN_PROGRESS' || (!r.attempt && r.status === 'REGISTERED' && Date.parse(r.entryClosesAt) > now))
      .sort((a, b) => Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt))[0];
  });

  protected openExams = computed(() => this.exams().filter((e) => e.registrationOpen && !e.myRegistrationId));

  ngOnInit(): void {
    forkJoin({ regs: this.api.registrations(), exams: this.api.exams() }).subscribe({
      next: ({ regs, exams }) => {
        this.registrations.set(regs);
        this.exams.set(exams);
        this.loading.set(false);
      },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  enterable(r: Registration): boolean { return canEnter(r, this.now()); }
  untilOpen(r: Registration): string { return until(Date.parse(r.entryOpensAt) - this.now()); }
  badge(r: Registration) { return registrationBadge(r, this.now()); }
}
