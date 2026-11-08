import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

const TZ = 'Asia/Kolkata';

const fmt = {
  dateTime: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
  date: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  dateShort: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' }),
  time: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
  timeSec: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  weekday: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long' }),
};

export type DateStyle = 'dateTime' | 'date' | 'dateShort' | 'time' | 'timeSec' | 'weekday';

export function formatIst(value: string | number | Date | null | undefined, style: DateStyle = 'dateTime'): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return fmt[style].format(d);
}

@Pipe({ name: 'ist' })
export class IstPipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, style: DateStyle = 'dateTime'): string {
    return formatIst(value, style);
  }
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    return minutes == null ? '—' : formatDuration(minutes);
  }
}

/** hh:mm:ss for a millisecond span. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "in 3 days", "in 4 h 12 min", "in 38 s" */
export function until(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  if (d >= 2) return `in ${d} days`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `in ${h} h ${m} min`;
  if (m >= 1) return `in ${m} min`;
  return `in ${s} s`;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Can’t reach the server. Check your connection.';
    const body = err.error as { message?: string } | null;
    if (body && typeof body === 'object' && body.message) return body.message;
  }
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: string } | null;
    return body && typeof body === 'object' ? body.code : undefined;
  }
  return undefined;
}

/** ISO → value for <input type="datetime-local"> in the browser's local zone. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function optionLetter(i: number): string {
  return String.fromCharCode(65 + i);
}
