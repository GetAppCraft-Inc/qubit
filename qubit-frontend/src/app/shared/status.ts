import { DestroyRef, inject, signal } from '@angular/core';
import { AttemptStatus, ExamStatus, Registration, RegistrationStatus } from '../core/models';

export interface BadgeSpec { label: string; cls: string; }

export function registrationBadge(r: Registration, now = Date.now()): BadgeSpec {
  const a = r.attempt?.status;
  if (a === 'TERMINATED' && r.appeal?.status === 'PENDING' && r.appeal) return { label: 'Appeal pending', cls: 'badge badge-warn' };
  if (a) return attemptBadge(a);
  if (r.status === 'CANCELLED') return { label: 'Cancelled', cls: 'badge' };
  if (r.retakeUntil) return now <= Date.parse(r.retakeUntil) ? { label: 'Retake open', cls: 'badge badge-ok' } : { label: 'Retake missed', cls: 'badge badge-warn' };
  const opens = Date.parse(r.entryOpensAt);
  const closes = Date.parse(r.entryClosesAt);
  if (now < opens) return { label: 'Scheduled', cls: 'badge badge-brand' };
  if (now <= closes) return { label: 'Open now', cls: 'badge badge-ok' };
  return { label: 'Missed', cls: 'badge badge-warn' };
}

export function attemptBadge(s: AttemptStatus): BadgeSpec {
  switch (s) {
    case 'IN_PROGRESS': return { label: 'In progress', cls: 'badge badge-ok' };
    case 'SUBMITTED': return { label: 'Submitted', cls: 'badge' };
    case 'AUTO_SUBMITTED': return { label: 'Time up', cls: 'badge' };
    case 'TERMINATED': return { label: 'Terminated', cls: 'badge badge-danger' };
  }
}

export function regStatusBadge(s: RegistrationStatus): BadgeSpec {
  switch (s) {
    case 'REGISTERED': return { label: 'Registered', cls: 'badge badge-brand' };
    case 'IN_PROGRESS': return { label: 'In progress', cls: 'badge badge-ok' };
    case 'SUBMITTED': return { label: 'Submitted', cls: 'badge' };
    case 'TERMINATED': return { label: 'Terminated', cls: 'badge badge-danger' };
    case 'CANCELLED': return { label: 'Cancelled', cls: 'badge' };
  }
}

export function examStatusBadge(s: ExamStatus): BadgeSpec {
  switch (s) {
    case 'DRAFT': return { label: 'Draft', cls: 'badge' };
    case 'PUBLISHED': return { label: 'Published', cls: 'badge badge-ok' };
    case 'CLOSED': return { label: 'Closed', cls: 'badge badge-warn' };
  }
}

/** Whether the candidate can walk into the exam room right now. */
export function canEnter(r: Registration, now = Date.now()): boolean {
  if (r.attempt) return r.attempt.status === 'IN_PROGRESS';
  if (r.status !== 'REGISTERED') return false;
  return now >= Date.parse(r.entryOpensAt) && now <= Date.parse(r.entryClosesAt);
}

/** A signal holding Date.now(), refreshed every `ms`. Must be called in an injection context. */
export function nowSignal(ms = 1000) {
  const now = signal(Date.now());
  const id = setInterval(() => now.set(Date.now()), ms);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return now.asReadonly();
}
