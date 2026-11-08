import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api.service';
import { errorMessage } from '../core/format';
import { MediaItem } from '../core/models';

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  sent: number;
  status: 'uploading' | 'finishing' | 'done' | 'failed';
  error?: string;
  assetId?: number;
}

/**
 * Resumable, parallel multipart uploads straight to storage (R2 presigned part URLs in production,
 * signed backend URLs locally). Survives route changes because it's a root service.
 */
@Injectable({ providedIn: 'root' })
export class Uploader {
  private api = inject(Api);
  readonly tasks = signal<UploadTask[]>([]);
  private listeners: ((m: MediaItem) => void)[] = [];

  onFinished(fn: (m: MediaItem) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((x) => x !== fn));
  }

  dismiss(id: string): void {
    this.tasks.update((l) => l.filter((t) => t.id !== id));
  }

  async upload(file: File, title?: string): Promise<void> {
    const id = crypto.randomUUID();
    this.tasks.update((l) => [...l, { id, name: file.name, size: file.size, sent: 0, status: 'uploading' }]);
    const patch = (p: Partial<UploadTask>) => this.tasks.update((l) => l.map((t) => (t.id === id ? { ...t, ...p } : t)));
    try {
      const type = file.type || guessType(file.name);
      const plan = await firstValueFrom(this.api.startUpload({ fileName: file.name, size: file.size, contentType: type, title }));
      patch({ assetId: plan.assetId });
      const progress = new Array(plan.partUrls.length).fill(0);
      const etags: { partNumber: number; etag: string }[] = [];
      let next = 0;
      const worker = async () => {
        while (next < plan.partUrls.length) {
          const i = next++;
          const blob = file.slice(i * plan.partSize, Math.min(file.size, (i + 1) * plan.partSize));
          const etag = await putWithRetry(plan.partUrls[i], blob, (loaded) => {
            progress[i] = loaded;
            patch({ sent: progress.reduce((a, b) => a + b, 0) });
          });
          etags.push({ partNumber: i + 1, etag });
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, plan.partUrls.length) }, worker));
      patch({ status: 'finishing', sent: file.size });
      const item = await firstValueFrom(this.api.completeUpload(plan.assetId, etags));
      patch({ status: 'done' });
      this.listeners.forEach((fn) => fn(item));
      setTimeout(() => this.dismiss(id), 4000);
    } catch (e) {
      patch({ status: 'failed', error: e instanceof Error && !('status' in e) ? e.message : errorMessage(e) });
    }
  }
}

function guessType(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (['mp4', 'mov', 'mkv', 'webm', 'm4v'].includes(ext ?? '')) return 'video/' + (ext === 'mov' ? 'quicktime' : ext);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext ?? '')) return 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
  return 'application/octet-stream';
}

/** XHR (not HttpClient) so no auth header leaks to R2 and upload progress is available. */
async function putWithRetry(url: string, blob: Blob, onProgress: (n: number) => void, attempts = 4): Promise<string> {
  let lastErr: unknown;
  for (let a = 0; a < attempts; a++) {
    try {
      return await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.upload.onprogress = (e) => onProgress(e.loaded);
        xhr.onload = () => {
          const etag = xhr.getResponseHeader('ETag');
          if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
          else reject(new Error(xhr.status >= 200 && xhr.status < 300 ? 'Storage did not return an ETag (check bucket CORS: expose ETag)' : `Part upload failed (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Network error while uploading'));
        xhr.send(blob);
      });
    } catch (e) {
      lastErr = e;
      onProgress(0);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** a));
    }
  }
  throw lastErr;
}
