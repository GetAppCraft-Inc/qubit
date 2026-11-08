import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { errorMessage, IstPipe } from '../core/format';
import { MediaItem, MediaKind } from '../core/models';
import { ToastService } from '../core/toast.service';
import { secondsLabel } from '../learn/learn-shared';
import { VideoPlayer } from '../shared/video-player';
import { Uploader } from './uploader';

export function bytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB';
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

@Component({
  selector: 'app-media',
  imports: [IstPipe, VideoPlayer],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div>
          <h1>Media library</h1>
          <p>Videos are encrypted and converted to adaptive streams up to 4K. PDFs and images are stored privately and served through short-lived links.</p>
        </div>
        <label class="btn btn-primary upload">
          Upload files
          <input type="file" multiple accept="video/*,application/pdf,image/*" (change)="pick($any($event.target))" />
        </label>
      </div>

      <div class="drop" [class.over]="over()" (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="drop($event)">
        <strong>Drop videos, PDFs or images here</strong>
        <span class="muted small">Uploads go straight to storage in 64 MB parts, 4 at a time, and retry automatically. Masters up to 60 GB.</span>
      </div>

      @if (uploader.tasks().length) {
        <ul class="tasks">
          @for (t of uploader.tasks(); track t.id) {
            <li [class.bad]="t.status === 'failed'">
              <div class="t-top">
                <span class="name">{{ t.name }}</span>
                <span class="mono small">
                  @switch (t.status) {
                    @case ('uploading') { {{ pct(t.sent, t.size) }}% · {{ size(t.sent) }} / {{ size(t.size) }} }
                    @case ('finishing') { Finishing… }
                    @case ('done') { Uploaded ✓ }
                    @case ('failed') { Failed }
                  }
                </span>
                @if (t.status === 'failed' || t.status === 'done') { <button type="button" class="btn btn-quiet btn-sm" (click)="uploader.dismiss(t.id)">✕</button> }
              </div>
              <div class="bar"><i [style.width.%]="pct(t.sent, t.size)"></i></div>
              @if (t.error) { <p class="err small">{{ t.error }}</p> }
            </li>
          }
        </ul>
      }

      <div class="tabs">
        @for (k of kinds; track k.key) {
          <button type="button" class="tab" [class.active]="kind() === k.key" (click)="kind.set(k.key)">{{ k.label }}<span class="count">{{ count(k.key) }}</span></button>
        }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (visible().length === 0 && !loading()) {
        <div class="card empty"><h3>Nothing here yet</h3><p>Upload a lecture video to get started.</p></div>
      } @else {
        <div class="grid">
          @for (m of visible(); track m.id) {
            <article class="item card">
              <div class="thumb" [class.doc]="m.kind === 'DOCUMENT'">
                @if (m.posterUrl) { <img [src]="m.posterUrl" alt="" loading="lazy" /> }
                @else if (m.kind === 'DOCUMENT') { <span class="mono">PDF</span> }
                @else { <span class="mono">{{ m.kind }}</span> }
                @if (m.durationSeconds) { <span class="dur mono">{{ dur(m.durationSeconds) }}</span> }
                @if (m.status === 'READY' && m.kind === 'VIDEO') { <button type="button" class="play" (click)="preview.set(m)" aria-label="Preview">▶</button> }
              </div>
              <div class="info">
                <input class="title" [value]="m.title" (change)="rename(m, $any($event.target).value)" aria-label="Title" />
                <p class="meta small muted">{{ size(m.sizeBytes) }} · {{ m.createdAt | ist: 'dateShort' }}@if (m.renditions.length) { · {{ m.renditions[0] }}p max }</p>
                @switch (m.status) {
                  @case ('READY') { <span class="badge badge-ok">Ready@if (m.encoder) { · {{ m.encoder === 'h264_nvenc' ? 'GPU' : 'CPU' }} }</span> }
                  @case ('FAILED') { <span class="badge badge-danger" [title]="m.error ?? ''">Failed</span> }
                  @case ('UPLOADING') { <span class="badge">Uploading</span> }
                  @case ('QUEUED') { <span class="badge badge-warn">Queued</span> }
                  @case ('PROCESSING') {
                    <div class="proc"><span class="badge badge-brand">Encoding {{ m.progress }}%</span><div class="bar"><i [style.width.%]="m.progress"></i></div></div>
                  }
                }
                @if (m.error && m.status === 'FAILED') { <p class="err small">{{ m.error }}</p> }
                <div class="acts">
                  @if (m.status === 'FAILED') { <button type="button" class="btn btn-ghost btn-sm" (click)="retry(m)">Retry</button> }
                  @if (m.inUse) { <span class="small muted">Used in a lesson</span> }
                  @else { <button type="button" class="btn btn-quiet btn-sm danger" (click)="remove(m)">Delete</button> }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (preview(); as p) {
      <div class="backdrop" (click)="preview.set(null)">
        <div class="dialog pv" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="spread"><h3>{{ p.title }}</h3><button type="button" class="btn btn-quiet btn-sm" (click)="preview.set(null)">Close</button></div>
          <app-video-player [assetId]="p.id" [poster]="p.posterUrl ?? null" [autoplay]="true" />
          <p class="small muted">Playing through the same encrypted pipeline learners use · {{ p.renditions.join(' / ') }}p</p>
        </div>
      </div>
    }
  `,
  styles: `
    .wide { max-width: 1320px; }
    .upload { position: relative; overflow: hidden; }
    .upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .drop { border: 1.5px dashed var(--line-strong); border-radius: 12px; padding: 22px; text-align: center; display: flex; flex-direction: column; gap: 4px; margin-bottom: 18px; background: var(--surface); transition: border-color .15s, background .15s; }
    .drop.over { border-color: var(--brand); background: var(--brand-soft); }
    .tasks { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; }
    .tasks li { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
    .tasks li.bad { border-color: #f2c9c3; }
    .t-top { display: flex; align-items: center; gap: 10px; }
    .name { flex: 1; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar { height: 6px; background: var(--paper-2); border-radius: 3px; overflow: hidden; margin-top: 6px; }
    .bar i { display: block; height: 100%; background: var(--brand); transition: width .3s; }
    .err { color: var(--danger); margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .item { overflow: hidden; display: flex; flex-direction: column; }
    .thumb { position: relative; aspect-ratio: 16 / 9; background: var(--ink); display: grid; place-items: center; color: #8d8a97; }
    .thumb.doc { background: var(--paper-2); color: var(--danger); font-weight: 700; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .dur { position: absolute; right: 8px; bottom: 8px; background: rgba(0,0,0,.7); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    .play { position: absolute; inset: 0; margin: auto; width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255,255,255,.92); cursor: pointer; font-size: 16px; color: var(--ink); opacity: 0; transition: opacity .15s; }
    .item:hover .play { opacity: 1; }
    .info { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
    .title { border: 1px solid transparent; background: none; font: inherit; font-weight: 600; font-size: 14.5px; padding: 3px 4px; margin: -3px -4px; border-radius: 5px; }
    .title:hover { border-color: var(--line); }
    .title:focus { outline: none; border-color: var(--brand); background: var(--surface); }
    .proc { display: flex; flex-direction: column; gap: 2px; }
    .acts { display: flex; gap: 6px; align-items: center; margin-top: 2px; }
    .danger { color: var(--danger) !important; }
    .dialog.pv { width: min(1000px, 100%); display: flex; flex-direction: column; gap: 12px; }
    .docv { width: 100%; height: 70vh; border: 1px solid var(--line); border-radius: 8px; }
  `,
})
export class MediaPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private toast = inject(ToastService);
  protected uploader = inject(Uploader);
  protected readonly kinds: { key: MediaKind | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'All' }, { key: 'VIDEO', label: 'Videos' }, { key: 'DOCUMENT', label: 'PDFs' }, { key: 'IMAGE', label: 'Images' }];

  protected items = signal<MediaItem[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected kind = signal<MediaKind | 'ALL'>('ALL');
  protected over = signal(false);
  protected preview = signal<MediaItem | null>(null);
  protected visible = computed(() => this.kind() === 'ALL' ? this.items() : this.items().filter((m) => m.kind === this.kind()));
  protected size = bytes;
  protected dur = secondsLabel;

  private poll = setInterval(() => {
    if (this.items().some((m) => m.status === 'QUEUED' || m.status === 'PROCESSING')) this.load();
  }, 3000);
  private off = this.uploader.onFinished(() => this.load());

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { clearInterval(this.poll); this.off(); }

  load(): void {
    this.api.media().subscribe({
      next: (l) => { this.items.set(l); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  count(k: MediaKind | 'ALL'): number { return k === 'ALL' ? this.items().length : this.items().filter((m) => m.kind === k).length; }
  pct(a: number, b: number): number { return b ? Math.min(100, Math.round((a / b) * 100)) : 0; }

  pick(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    files.forEach((f) => this.uploader.upload(f));
  }

  drop(e: DragEvent): void {
    e.preventDefault();
    this.over.set(false);
    Array.from(e.dataTransfer?.files ?? []).forEach((f) => this.uploader.upload(f));
  }

  rename(m: MediaItem, title: string): void {
    if (!title.trim() || title === m.title) return;
    this.api.renameMedia(m.id, title.trim()).subscribe({ next: (x) => this.replace(x), error: (e) => this.toast.error(errorMessage(e)) });
  }

  retry(m: MediaItem): void {
    this.api.retryMedia(m.id).subscribe({ next: (x) => this.replace(x), error: (e) => this.toast.error(errorMessage(e)) });
  }

  remove(m: MediaItem): void {
    if (!confirm(`Delete “${m.title}”? This removes the file and all its encoded streams.`)) return;
    this.api.deleteMedia(m.id).subscribe({
      next: () => { this.items.update((l) => l.filter((x) => x.id !== m.id)); this.toast.ok('Deleted.'); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  private replace(x: MediaItem): void { this.items.update((l) => l.map((m) => (m.id === x.id ? x : m))); }
}
