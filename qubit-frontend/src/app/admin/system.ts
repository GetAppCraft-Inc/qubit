import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { SystemInfo } from '../core/models';

@Component({
  selector: 'app-system',
  imports: [IstPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>System</h1>
          <p>Runtime health for developers. Refreshes every 10 seconds.</p>
        </div>
        <button class="btn btn-ghost" type="button" (click)="load()">Refresh</button>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (info(); as s) {
        <div class="grid">
          <div class="tile" [class.bad]="!s.databaseUp">
            <span class="k">Database</span>
            <span class="v">{{ s.databaseUp ? 'Connected' : 'Unreachable' }}</span>
            <span class="s mono">{{ s.databaseProduct || '—' }}</span>
          </div>
          <div class="tile" [class.warn]="!s.mailEnabled">
            <span class="k">Email (SMTP)</span>
            <span class="v">{{ s.mailEnabled ? 'Sending' : 'Log only' }}</span>
            <span class="s">{{ s.mailEnabled ? 'Verification & welcome mails are delivered.' : 'Set MAIL_HOST to deliver mail; links are printed to the server log.' }}</span>
          </div>
          <div class="tile">
            <span class="k">WebSockets</span>
            <span class="v mono">{{ s.liveExamSockets }} <small>exam</small> · {{ s.monitorSockets }} <small>monitor</small></span>
            <span class="s">Open connections right now</span>
          </div>
          <div class="tile">
            <span class="k">Memory</span>
            <span class="v mono">{{ s.heapUsedMb }} <small>/ {{ s.heapMaxMb }} MB</small></span>
            <div class="bar"><i [style.width.%]="(s.heapUsedMb / s.heapMaxMb) * 100"></i></div>
          </div>
          <div class="tile">
            <span class="k">Uptime</span>
            <span class="v mono">{{ uptime(s.uptimeSeconds) }}</span>
            <span class="s">{{ s.availableProcessors }} CPU cores</span>
          </div>
          <div class="tile">
            <span class="k">Runtime</span>
            <span class="v mono">Java {{ s.javaVersion }}</span>
            <span class="s mono">Spring Boot {{ s.springBootVersion }}</span>
          </div>
        </div>
        <p class="muted small foot">Server time {{ s.serverTime | ist: 'timeSec' }} IST · health endpoint <span class="mono">/actuator/health</span></p>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    .tile { background: var(--surface); padding: 20px; display: flex; flex-direction: column; gap: 4px; min-height: 130px; border-top: 3px solid var(--ok); }
    .tile.bad { border-top-color: var(--danger); }
    .tile.warn { border-top-color: var(--warn); }
    .k { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .v { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    .v small { font-size: 13px; color: var(--muted); font-weight: 400; }
    .s { font-size: 12.5px; color: var(--muted); }
    .bar { height: 6px; background: var(--paper-2); border-radius: 3px; margin-top: 8px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--ink); }
    .foot { margin-top: 14px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class SystemPage implements OnInit, OnDestroy {
  private api = inject(Api);
  protected info = signal<SystemInfo | null>(null);
  protected error = signal<string | null>(null);
  private timer = setInterval(() => this.load(), 10000);

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { clearInterval(this.timer); }

  load(): void {
    this.api.system().subscribe({ next: (s) => { this.info.set(s); this.error.set(null); }, error: (e) => this.error.set(errorMessage(e)) });
  }

  uptime(s: number): string {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
  }
}
