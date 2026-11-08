import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'ok' | 'error' | 'info'; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  ok(text: string): void { this.push('ok', text); }
  error(text: string): void { this.push('error', text, 6000); }
  info(text: string): void { this.push('info', text); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], text: string, ttl = 3800): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
