import { Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Hls, { Level } from 'hls.js';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { clock, errorCode, errorMessage } from '../core/format';
import { PlaybackInfo } from '../core/models';

const DEVICE_KEY = 'qubit.device';

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    return 'ephemeral-' + Math.random().toString(36).slice(2);
  }
}

/**
 * Protected HLS player. Keys are fetched with the viewer's JWT and device id (never cached),
 * segments come from signed URLs, and a moving watermark identifies the viewer.
 */
@Component({
  selector: 'app-video-player',
  template: `
    <div class="player" #wrap tabindex="0" (keydown)="onKey($event)" (contextmenu)="$event.preventDefault()"
         (mousemove)="poke()" [class.idle]="idle() && playing()">
      <video #video playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"
             [poster]="info()?.posterUrl ?? poster() ?? ''" (click)="toggle()" (dblclick)="fullscreen()"
             (timeupdate)="onTime()" (play)="playing.set(true)" (pause)="playing.set(false)" (ended)="onEnded()"
             (waiting)="buffering.set(true)" (playing)="buffering.set(false)" (volumechange)="onVolume()"
             (loadedmetadata)="onMeta()"></video>

      @if (info()) {
        <div class="mark" [style.left.%]="markPos().x" [style.top.%]="markPos().y" aria-hidden="true">
          {{ info()!.watermark }}<br />{{ markTime() }}
        </div>
      }

      @if (error()) {
        <div class="overlay"><div class="msg"><strong>Can't play this video</strong><span>{{ error() }}</span>
          <button class="btn btn-ghost btn-sm" type="button" (click)="restart()">Try again</button></div></div>
      } @else if (!started()) {
        <button class="big-play" type="button" (click)="begin()" [disabled]="loading()" aria-label="Play">
          @if (loading()) { <span class="spinner"></span> } @else {
            <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
          }
        </button>
      } @else if (buffering()) {
        <div class="buffer"><span class="spinner"></span></div>
      }

      @if (started() && !error()) {
        <div class="bar">
          <input class="seek" type="range" min="0" [max]="duration() || 0" step="0.1" [value]="time()"
                 (input)="seek(+$any($event.target).value)" aria-label="Seek" [style.--p]="pct() + '%'" />
          <div class="row-c">
            <button type="button" class="ic" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause' : 'Play'">
              @if (playing()) { <svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg> }
              @else { <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg> }
            </button>
            <button type="button" class="ic" (click)="skip(-10)" aria-label="Back 10 seconds">
              <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" fill="currentColor"/></svg>
            </button>
            <button type="button" class="ic" (click)="skip(10)" aria-label="Forward 10 seconds">
              <svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" fill="currentColor"/></svg>
            </button>
            <button type="button" class="ic" (click)="mute()" [attr.aria-label]="muted() ? 'Unmute' : 'Mute'">
              @if (muted() || volume() === 0) { <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm12.6 3 2.2-2.2-1.1-1.1-2.2 2.2-2.2-2.2-1.1 1.1 2.2 2.2-2.2 2.2 1.1 1.1 2.2-2.2 2.2 2.2 1.1-1.1z" fill="currentColor"/></svg> }
              @else { <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor"/></svg> }
            </button>
            <input class="vol" type="range" min="0" max="1" step="0.05" [value]="muted() ? 0 : volume()" (input)="setVolume(+$any($event.target).value)" aria-label="Volume" />
            <span class="time mono">{{ clockOf(time()) }} / {{ clockOf(duration()) }}</span>
            <span class="grow"></span>
            <div class="menu-wrap">
              <button type="button" class="pill mono" (click)="menu.set(menu() === 'speed' ? null : 'speed')">{{ rate() }}×</button>
              @if (menu() === 'speed') {
                <ul class="menu">@for (r of rates; track r) { <li><button type="button" [class.on]="r === rate()" (click)="setRate(r)">{{ r }}×</button></li> }</ul>
              }
            </div>
            <div class="menu-wrap">
              <button type="button" class="pill mono" (click)="menu.set(menu() === 'quality' ? null : 'quality')">{{ qualityLabel() }}</button>
              @if (menu() === 'quality') {
                <ul class="menu">
                  <li><button type="button" [class.on]="chosen() === -1" (click)="setLevel(-1)">Auto</button></li>
                  @for (l of levels(); track l.index) {
                    <li><button type="button" [class.on]="chosen() === l.index" (click)="setLevel(l.index)">{{ l.label }}</button></li>
                  }
                </ul>
              }
            </div>
            <button type="button" class="ic" (click)="fullscreen()" aria-label="Full screen">
              <svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zm5 16h-5v2h7v-7h-2zM5 14H3v7h7v-2H5z" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .player { position: relative; background: #000; border-radius: 12px; overflow: hidden; aspect-ratio: 16 / 9; outline: none; user-select: none; -webkit-user-select: none; }
    .player:fullscreen { border-radius: 0; aspect-ratio: auto; }
    .player.idle { cursor: none; }
    video { width: 100%; height: 100%; display: block; object-fit: contain; background: #000; }
    .mark { position: absolute; transform: translate(-50%, -50%); color: rgba(255, 255, 255, .34); font-family: var(--mono); font-size: 12px;
      line-height: 1.4; text-align: center; pointer-events: none; text-shadow: 0 0 2px rgba(0, 0, 0, .5); transition: left 1.2s ease, top 1.2s ease; white-space: nowrap; z-index: 2; }
    .big-play { position: absolute; inset: 0; margin: auto; width: 76px; height: 76px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .94);
      color: var(--ink); display: grid; place-items: center; cursor: pointer; box-shadow: 0 10px 40px rgba(0, 0, 0, .4); z-index: 3; }
    .big-play svg { margin-left: 4px; }
    .buffer { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; pointer-events: none; }
    .overlay { position: absolute; inset: 0; background: rgba(10, 10, 14, .86); display: grid; place-items: center; z-index: 4; padding: 20px; }
    .msg { color: #e9e8ee; text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center; max-width: 380px; font-size: 14px; }
    .msg strong { color: #fff; font-size: 16px; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 14px 10px; background: linear-gradient(transparent, rgba(0, 0, 0, .78)); z-index: 3; transition: opacity .25s; }
    .idle .bar { opacity: 0; }
    .row-c { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
    .grow { flex: 1; }
    .ic { width: 34px; height: 34px; border: 0; background: none; color: #fff; display: grid; place-items: center; border-radius: 6px; cursor: pointer; }
    .ic:hover { background: rgba(255, 255, 255, .14); }
    .ic svg { width: 22px; height: 22px; }
    .time { color: #e9e8ee; font-size: 12.5px; margin-left: 8px; }
    .pill { height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, .28); background: rgba(0, 0, 0, .3); color: #fff; font-size: 12px; cursor: pointer; }
    .pill:hover { border-color: #fff; }
    .menu-wrap { position: relative; margin-left: 4px; }
    .menu { position: absolute; right: 0; bottom: 36px; list-style: none; margin: 0; padding: 4px; background: rgba(18, 17, 22, .96); border: 1px solid #2a2930; border-radius: 8px; min-width: 96px; }
    .menu button { width: 100%; text-align: left; border: 0; background: none; color: #d2d0d9; padding: 7px 10px; border-radius: 5px; font-size: 13px; cursor: pointer; font-family: var(--mono); }
    .menu button:hover { background: rgba(255, 255, 255, .08); color: #fff; }
    .menu button.on { color: #b7a7ff; }
    input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
    .seek { width: 100%; height: 14px; }
    .seek::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, #b7a7ff var(--p), rgba(255, 255, 255, .28) var(--p)); }
    .seek::-moz-range-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, #b7a7ff var(--p), rgba(255, 255, 255, .28) var(--p)); }
    .seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; margin-top: -4px; }
    .seek::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: #fff; }
    .vol { width: 72px; }
    .vol::-webkit-slider-runnable-track { height: 3px; background: rgba(255, 255, 255, .4); border-radius: 2px; }
    .vol::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #fff; margin-top: -3.5px; }
    @media (max-width: 600px) { .vol, .time { display: none; } }
  `,
})
export class VideoPlayer implements OnDestroy {
  private api = inject(Api);
  private auth = inject(AuthService);

  /** Learner mode */
  lessonId = input<number | null>(null);
  /** Admin preview mode */
  assetId = input<number | null>(null);
  poster = input<string | null>(null);
  autoplay = input(false);
  ended = output<void>();
  completed = output<void>();

  private video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');

  protected info = signal<PlaybackInfo | null>(null);
  protected started = signal(false);
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected playing = signal(false);
  protected buffering = signal(false);
  protected time = signal(0);
  protected duration = signal(0);
  protected volume = signal(1);
  protected muted = signal(false);
  protected rate = signal(1);
  protected menu = signal<'speed' | 'quality' | null>(null);
  protected levels = signal<{ index: number; label: string; height: number }[]>([]);
  protected chosen = signal(-1);
  protected current = signal(-1);
  protected idle = signal(false);
  protected markPos = signal({ x: 50, y: 50 });
  protected markTime = signal('');

  protected readonly rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  protected readonly clockOf = (s: number) => clock(s * 1000).replace(/^00:/, '');
  protected pct = computed(() => (this.duration() ? (this.time() / this.duration()) * 100 : 0));
  protected qualityLabel = computed(() => {
    const lv = this.levels().find((l) => l.index === (this.chosen() === -1 ? this.current() : this.chosen()));
    const h = lv ? lv.label : '';
    return this.chosen() === -1 ? `Auto${h ? ' · ' + h : ''}` : h;
  });

  private hls: Hls | null = null;
  private dev = deviceId();
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private markTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTime = 0;
  private watched = 0;
  private resumeAt = 0;
  private completedEmitted = false;

  constructor() {
    effect(() => {
      this.lessonId();
      this.assetId();
      untracked(() => {
        this.teardown();
        this.started.set(false);
        this.error.set(null);
        this.info.set(null);
        if (this.autoplay()) this.begin();
      });
    });
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  begin(): void {
    if (this.loading()) return;
    if (!Hls.isSupported()) {
      this.error.set('This browser cannot play protected video. Use a recent Chrome, Edge, Firefox or Safari.');
      return;
    }
    const lesson = this.lessonId();
    const asset = this.assetId();
    if (!lesson && !asset) return;
    this.loading.set(true);
    const req = lesson ? this.api.startPlayback(lesson, this.dev) : this.api.previewMedia(asset!, this.dev);
    req.subscribe({
      next: (info) => { this.loading.set(false); this.attach(info); },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(errorCode(e) === 'STREAM_LIMIT' ? errorMessage(e) : errorMessage(e, 'Could not start playback.'));
      },
    });
  }

  restart(): void {
    this.teardown();
    this.error.set(null);
    this.started.set(false);
    this.begin();
  }

  private attach(info: PlaybackInfo): void {
    this.info.set(info);
    this.started.set(true);
    this.resumeAt = info.resumeAt > 5 ? info.resumeAt : 0;
    const video = this.video().nativeElement;
    const token = this.auth.token();
    const origin = location.origin;
    const dev = this.dev;
    const hls = new Hls({
      startPosition: this.resumeAt,
      enableWorker: true,
      capLevelToPlayerSize: false,
      maxBufferLength: 30,
      xhrSetup: (xhr, url) => {
        // Only our own API gets credentials — never the CDN / R2 gateway.
        const u = new URL(url, location.href);
        if (u.origin === origin && u.pathname.startsWith('/api/')) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.setRequestHeader('X-Qubit-Device', dev);
        }
      },
    });
    this.hls = hls;
    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      this.levels.set(
        data.levels
          .map((l: Level, index: number) => ({ index, height: l.height, label: label(l.height) }))
          .sort((a: { height: number }, b: { height: number }) => b.height - a.height),
      );
      video.play().catch(() => undefined);
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => this.current.set(d.level));
    hls.on(Hls.Events.ERROR, (_e, d) => {
      if (!d.fatal) return;
      const status = (d.response as { code?: number } | undefined)?.code;
      if (status === 410 || status === 403 || status === 409) {
        this.error.set('Your playback session ended (another device, or it expired). Press "Try again".');
        this.teardown();
      } else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
      } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        this.error.set('Playback failed. Check your connection and try again.');
        this.teardown();
      }
    });
    hls.loadSource(info.manifestUrl);
    hls.attachMedia(video);

    this.beatTimer = setInterval(() => this.beat(false), 15000);
    this.moveMark();
    this.markTimer = setInterval(() => this.moveMark(), 12000);
    this.wrap().nativeElement.focus();
  }

  private teardown(): void {
    if (this.beatTimer) clearInterval(this.beatTimer);
    if (this.markTimer) clearInterval(this.markTimer);
    this.beatTimer = this.markTimer = null;
    const info = this.info();
    if (info && this.hls) {
      this.beat(false);
      this.api.endPlayback(info.token).subscribe({ error: () => undefined });
    }
    this.hls?.destroy();
    this.hls = null;
  }

  private beat(ended: boolean): void {
    const info = this.info();
    if (!info) return;
    const delta = Math.round(this.watched);
    this.watched -= delta;
    const pos = this.video().nativeElement.currentTime || 0;
    this.api.heartbeat(info.token, pos, delta, ended).subscribe({
      error: (e: HttpErrorResponse) => {
        if (e.status === 410 || e.status === 404) {
          this.video().nativeElement.pause();
          this.error.set('This playback session ended — it may have been opened on another device.');
          this.teardown();
        }
      },
    });
    if (!this.completedEmitted && this.duration() > 0 && (ended || pos >= this.duration() * 0.9)) {
      this.completedEmitted = true;
      setTimeout(() => this.completed.emit(), 400);
    }
  }

  private moveMark(): void {
    this.markPos.set({ x: 18 + Math.random() * 64, y: 14 + Math.random() * 62 });
    this.markTime.set(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
  }

  // ---- controls ----
  toggle(): void {
    const v = this.video().nativeElement;
    if (!this.started()) { this.begin(); return; }
    if (v.paused) v.play().catch(() => undefined); else v.pause();
  }
  seek(t: number): void { this.video().nativeElement.currentTime = t; this.time.set(t); }
  skip(s: number): void { const v = this.video().nativeElement; this.seek(Math.max(0, Math.min(v.duration || 0, v.currentTime + s))); }
  mute(): void { const v = this.video().nativeElement; v.muted = !v.muted; }
  setVolume(x: number): void { const v = this.video().nativeElement; v.volume = x; v.muted = x === 0; }
  setRate(r: number): void { this.video().nativeElement.playbackRate = r; this.rate.set(r); this.menu.set(null); }
  setLevel(i: number): void { if (this.hls) this.hls.currentLevel = i; this.chosen.set(i); this.menu.set(null); }
  fullscreen(): void {
    const w = this.wrap().nativeElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else w.requestFullscreen().catch(() => undefined);
  }
  poke(): void {
    this.idle.set(false);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.idle.set(true), 2500);
  }

  onKey(e: KeyboardEvent): void {
    if (!this.started()) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); this.toggle(); }
    else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); this.skip(-10); }
    else if (k === 'arrowright' || k === 'l') { e.preventDefault(); this.skip(10); }
    else if (k === 'f') this.fullscreen();
    else if (k === 'm') this.mute();
  }

  onTime(): void {
    const v = this.video().nativeElement;
    const t = v.currentTime;
    const d = t - this.lastTime;
    if (!v.paused && d > 0 && d < 3) this.watched += d / Math.max(1, v.playbackRate);
    this.lastTime = t;
    this.time.set(t);
  }
  onMeta(): void { this.duration.set(this.video().nativeElement.duration || this.info()?.durationSeconds || 0); }
  onVolume(): void { const v = this.video().nativeElement; this.volume.set(v.volume); this.muted.set(v.muted); }
  onEnded(): void { this.beat(true); this.ended.emit(); }
}

function label(h: number): string {
  if (h >= 2160) return '2160p 4K';
  if (h >= 1440) return '1440p';
  return `${h}p${h >= 720 ? ' HD' : ''}`;
}
