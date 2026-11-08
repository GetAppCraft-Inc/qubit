import { Component, inject, input, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Api } from '../core/api.service';
import { errorMessage } from '../core/format';
import {
  CATEGORY_LABEL, CourseAdmin, CourseStatus, ExamCategory, ExamSummary, LessonAdmin, LessonRequest, LessonType, MediaItem, ModuleAdmin,
} from '../core/models';
import { ToastService } from '../core/toast.service';
import { LESSON_ICON, LESSON_LABEL, secondsLabel } from '../learn/learn-shared';

type CourseForm = { title: string; slug: string; subtitle: string; category: ExamCategory; validityDays: string | number; description: string; coverImage: string };

interface LessonDraft { id?: number; moduleId: number; title: string; type: LessonType; assetId: number | null; body: string; examId: number | null; freePreview: boolean; }

@Component({
  selector: 'app-course-editor',
  imports: [RouterLink, TitleCasePipe],
  template: `
    <div class="page">
      <a routerLink="/admin/courses" class="back small">← Courses</a>

      <div class="head">
        <div>
          <p class="eyebrow">{{ c() ? labels[c()!.category] + ' · ' + c()!.slug : 'New course' }}</p>
          <h1>{{ c()?.title || 'Create a course' }}</h1>
          @if (c(); as c) {
            <p class="meta">
              <span [class]="c.status === 'PUBLISHED' ? 'badge badge-ok' : c.status === 'ARCHIVED' ? 'badge badge-warn' : 'badge'">{{ c.status }}</span>
              <span>{{ c.lessonCount }} lessons</span><span>{{ dur(c.totalDurationSeconds) || 'no video yet' }}</span><span>{{ c.enrollments }} learners</span>
            </p>
          }
        </div>
        @if (c(); as c) {
          <div class="row row-wrap">
            <a class="btn btn-ghost" [routerLink]="['/app/courses', c.slug]">View as learner</a>
            @if (c.status !== 'PUBLISHED') { <button class="btn btn-brand" type="button" (click)="status('PUBLISHED')" [disabled]="busy()">Publish</button> }
            @if (c.status === 'PUBLISHED') { <button class="btn btn-ghost" type="button" (click)="status('ARCHIVED')" [disabled]="busy()">Archive</button> }
            @if (c.status === 'PUBLISHED' && c.enrollments === 0) { <button class="btn btn-ghost" type="button" (click)="status('DRAFT')" [disabled]="busy()">Unpublish</button> }
            @if (c.enrollments === 0) { <button class="btn btn-quiet danger" type="button" (click)="remove()" [disabled]="busy()">Delete</button> }
          </div>
        }
      </div>

      <section class="fs">
        <div class="fs-label"><h3>Details</h3><p>What learners see in the catalog.</p></div>
        <div class="fs-body card card-pad">
          <div class="grid-2">
            <div class="field"><label for="t">Title</label><input id="t" class="input" [value]="f().title" (input)="patch({ title: $any($event.target).value })" placeholder="Physics Foundation · Mechanics" /></div>
            <div class="field"><label for="s">URL slug <span class="faint">(optional)</span></label><input id="s" class="input mono" [value]="f().slug" (input)="patch({ slug: $any($event.target).value })" placeholder="auto from title" /></div>
          </div>
          <div class="field"><label for="st">Subtitle</label><input id="st" class="input" [value]="f().subtitle" (input)="patch({ subtitle: $any($event.target).value })" placeholder="Kinematics to rotation, in 40 lectures" /></div>
          <div class="grid-2">
            <div class="field"><label for="cat">Exam</label>
              <select id="cat" class="select" [value]="f().category" (change)="patch({ category: $any($event.target).value })">
                @for (k of categories; track k) { <option [value]="k">{{ labels[k] }}</option> }
              </select>
            </div>
            <div class="field"><label for="v">Access after enrolling <span class="faint">(days, blank = lifetime)</span></label>
              <input id="v" class="input mono" type="number" min="1" [value]="f().validityDays" (input)="patch({ validityDays: $any($event.target).value })" />
            </div>
          </div>
          <div class="field"><label for="d">Description</label><textarea id="d" class="textarea" rows="5" [value]="f().description" (input)="patch({ description: $any($event.target).value })"></textarea></div>
          <div class="field">
            <span class="label">Cover image <span class="faint">(16:9, up to 500 KB)</span></span>
            <div class="row">
              @if (f().coverImage) { <img class="cover" [src]="f().coverImage" alt="Cover" /> }
              <label class="btn btn-ghost btn-sm upl">{{ f().coverImage ? 'Replace' : 'Upload' }}<input type="file" accept="image/*" (change)="cover($any($event.target))" /></label>
              @if (f().coverImage) { <button type="button" class="btn btn-quiet btn-sm" (click)="patch({ coverImage: '' })">Remove</button> }
            </div>
          </div>
          <div class="row" style="justify-content: flex-end"><button class="btn btn-primary" type="button" (click)="save()" [disabled]="busy()">{{ c() ? 'Save details' : 'Create course' }}</button></div>
        </div>
      </section>

      @if (c(); as c) {
        <section class="fs">
          <div class="fs-label"><h3>Curriculum</h3><p>Modules group lessons. Order them the way learners should take them.</p></div>
          <div class="fs-body">
            @for (m of c.modules; track m.id; let mi = $index; let mFirst = $first; let mLast = $last) {
              <div class="module card">
                <div class="m-head">
                  <span class="mono num">{{ mi + 1 }}</span>
                  <input class="m-title" [value]="m.title" (change)="renameModule(m, $any($event.target).value)" aria-label="Module title" />
                  <button type="button" class="btn btn-quiet btn-sm" (click)="moveModule(mi, -1)" [disabled]="mFirst" aria-label="Move up">↑</button>
                  <button type="button" class="btn btn-quiet btn-sm" (click)="moveModule(mi, 1)" [disabled]="mLast" aria-label="Move down">↓</button>
                  <button type="button" class="btn btn-quiet btn-sm danger" (click)="deleteModule(m)">Delete</button>
                </div>
                <ul class="lessons">
                  @for (l of m.lessons; track l.id; let li = $index; let lFirst = $first; let lLast = $last) {
                    <li>
                      <svg viewBox="0 0 16 16" class="ic"><path [attr.d]="icon[l.type]"/></svg>
                      <div class="l-main">
                        <strong>{{ l.title }}</strong>
                        <span class="muted small">{{ lessonLabel[l.type] }}
                          @if (l.assetTitle) { · {{ l.assetTitle }} }
                          @if (l.durationSeconds) { · {{ dur(l.durationSeconds) }} }
                          @if (l.examTitle) { · {{ l.examTitle }} }
                        </span>
                      </div>
                      @if (l.assetStatus && l.assetStatus !== 'READY') { <span class="badge badge-warn">{{ l.assetStatus | titlecase }}</span> }
                      @if (l.freePreview) { <span class="badge badge-brand">Preview</span> }
                      <button type="button" class="btn btn-quiet btn-sm" (click)="moveLesson(m, li, -1)" [disabled]="lFirst">↑</button>
                      <button type="button" class="btn btn-quiet btn-sm" (click)="moveLesson(m, li, 1)" [disabled]="lLast">↓</button>
                      <button type="button" class="btn btn-quiet btn-sm" (click)="editLesson(m, l)">Edit</button>
                      <button type="button" class="btn btn-quiet btn-sm danger" (click)="deleteLesson(l)">✕</button>
                    </li>
                  }
                </ul>
                @if (draft()?.moduleId === m.id) {
                  <div class="draft">
                    <div class="grid-2">
                      <div class="field"><label for="lt">Lesson title</label><input id="lt" class="input" [value]="draft()!.title" (input)="patchDraft({ title: $any($event.target).value })" /></div>
                      <div class="field"><span class="label">Type</span>
                        <div class="seg">
                          @for (t of types; track t) {
                            <button type="button" [class.on]="draft()!.type === t" (click)="patchDraft({ type: t, assetId: null, examId: null })">{{ lessonLabel[t] }}</button>
                          }
                        </div>
                      </div>
                    </div>
                    @if (draft()!.type === 'VIDEO' || draft()!.type === 'DOCUMENT') {
                      <div class="field">
                        <label for="la">{{ draft()!.type === 'VIDEO' ? 'Video' : 'PDF' }} from the media library</label>
                        <select id="la" class="select" [value]="draft()!.assetId ?? ''" (change)="patchDraft({ assetId: +$any($event.target).value || null })">
                          <option value="">Choose…</option>
                          @for (a of assetsFor(draft()!.type); track a.id) {
                            <option [value]="a.id">{{ a.title }} — {{ a.status === 'READY' ? (a.durationSeconds ? dur(a.durationSeconds) : 'ready') : a.status.toLowerCase() }}</option>
                          }
                        </select>
                        <span class="hint">Not there? <a routerLink="/admin/media" class="link">Upload it to the media library</a> first.</span>
                      </div>
                    }
                    @if (draft()!.type === 'QUIZ') {
                      <div class="field">
                        <label for="lq">Assessment</label>
                        <select id="lq" class="select" [value]="draft()!.examId ?? ''" (change)="patchDraft({ examId: +$any($event.target).value || null })">
                          <option value="">Choose…</option>
                          @for (e of exams(); track e.id) { <option [value]="e.id">{{ e.title }} ({{ e.mode === 'OPEN' ? 'open quiz' : 'proctored' }} · {{ e.status.toLowerCase() }})</option> }
                        </select>
                      </div>
                    }
                    <div class="field">
                      <label for="lb">{{ draft()!.type === 'ARTICLE' ? 'Article' : 'Notes under the lesson' }} <span class="faint">($…$ for maths)</span></label>
                      <textarea id="lb" class="textarea" rows="4" [value]="draft()!.body" (input)="patchDraft({ body: $any($event.target).value })"></textarea>
                    </div>
                    <label class="check"><input type="checkbox" [checked]="draft()!.freePreview" (change)="patchDraft({ freePreview: $any($event.target).checked })" /><span>Free preview — anyone signed in can open this lesson</span></label>
                    <div class="row" style="justify-content: flex-end">
                      <button type="button" class="btn btn-quiet" (click)="draft.set(null)">Cancel</button>
                      <button type="button" class="btn btn-primary" (click)="saveLesson()" [disabled]="busy()">{{ draft()!.id ? 'Save lesson' : 'Add lesson' }}</button>
                    </div>
                  </div>
                } @else {
                  <button type="button" class="link small add" (click)="newLesson(m)">+ Add lesson</button>
                }
              </div>
            }
            <div class="new-module">
              <input class="input" placeholder="New module title, e.g. Kinematics" [value]="moduleTitle()" (input)="moduleTitle.set($any($event.target).value)" (keydown.enter)="addModule()" />
              <button type="button" class="btn btn-ghost" (click)="addModule()" [disabled]="!moduleTitle().trim() || busy()">Add module</button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .back { color: var(--muted); text-decoration: none; display: inline-block; margin-bottom: 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
    .head h1 { margin-top: 6px; }
    .meta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: 8px; font-size: 13.5px; color: var(--muted); }
    .fs { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; padding: 24px 0; border-top: 1px solid var(--line); }
    .fs-label h3 { font-size: 15px; } .fs-label p { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .fs-body { display: flex; flex-direction: column; gap: 14px; }
    .cover { width: 180px; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); }
    .upl { position: relative; overflow: hidden; } .upl input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .module { padding: 6px 14px 12px; }
    .m-head { display: flex; align-items: center; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); }
    .m-head .num { color: var(--brand); font-weight: 600; width: 22px; }
    .m-title { flex: 1; border: 1px solid transparent; background: none; font: inherit; font-weight: 600; font-size: 15.5px; padding: 5px 6px; border-radius: 6px; }
    .m-title:hover { border-color: var(--line); } .m-title:focus { outline: none; border-color: var(--brand); background: var(--surface); }
    .lessons { list-style: none; padding: 0; margin: 0; }
    .lessons li { display: flex; align-items: center; gap: 8px; padding: 9px 2px; border-bottom: 1px solid var(--line); }
    .ic { width: 16px; height: 16px; fill: none; stroke: var(--muted); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .l-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .l-main strong { font-weight: 550; font-size: 14px; }
    .add { margin-top: 10px; }
    .draft { margin-top: 12px; padding: 14px; border: 1px solid var(--brand-line); border-radius: 10px; background: #fcfbff; display: flex; flex-direction: column; gap: 12px; }
    .seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 8px; padding: 2px; background: var(--paper); flex-wrap: wrap; }
    .seg button { border: 0; background: none; padding: 7px 12px; border-radius: 6px; font-size: 13px; font-weight: 550; color: var(--muted); cursor: pointer; }
    .seg button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }
    .new-module { display: flex; gap: 8px; }
    .danger { color: var(--danger) !important; }
    @media (max-width: 860px) { .fs { grid-template-columns: 1fr; gap: 12px; } }
  `,
})
export class CourseEditor implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected labels = CATEGORY_LABEL;
  protected categories = Object.keys(CATEGORY_LABEL) as ExamCategory[];
  protected icon = LESSON_ICON;
  protected lessonLabel = LESSON_LABEL;
  protected types: LessonType[] = ['VIDEO', 'DOCUMENT', 'ARTICLE', 'QUIZ'];
  protected dur = secondsLabel;

  id = input<string>();
  protected c = signal<CourseAdmin | null>(null);
  protected busy = signal(false);
  protected f = signal<CourseForm>({ title: '', slug: '', subtitle: '', category: 'JEE_MAIN', validityDays: '', description: '', coverImage: '' });
  protected draft = signal<LessonDraft | null>(null);
  protected moduleTitle = signal('');
  protected media = signal<MediaItem[]>([]);
  protected exams = signal<ExamSummary[]>([]);

  ngOnInit(): void {
    const id = this.id();
    if (id) this.api.adminCourse(+id).subscribe({ next: (c) => this.set(c), error: (e) => this.toast.error(errorMessage(e)) });
    this.api.media().subscribe({ next: (m) => this.media.set(m) });
    this.api.adminExams().subscribe({ next: (e) => this.exams.set(e) });
  }

  private set(c: CourseAdmin): void {
    this.c.set(c);
    this.f.set({ title: c.title, slug: c.slug, subtitle: c.subtitle ?? '', category: c.category, validityDays: c.validityDays ?? '', description: c.description ?? '', coverImage: c.coverImage ?? '' });
  }

  patch(p: Partial<CourseForm>): void { this.f.update((v) => ({ ...v, ...p })); }
  patchDraft(p: Partial<LessonDraft>): void { this.draft.update((d) => (d ? { ...d, ...p } : d)); }

  assetsFor(t: LessonType): MediaItem[] {
    const kind = t === 'VIDEO' ? 'VIDEO' : 'DOCUMENT';
    return this.media().filter((m) => m.kind === kind && m.status !== 'FAILED' && m.status !== 'UPLOADING');
  }

  cover(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 500_000) { this.toast.error('Cover must be under 500 KB.'); return; }
    const r = new FileReader();
    r.onload = () => this.patch({ coverImage: String(r.result) });
    r.readAsDataURL(file);
  }

  save(): void {
    const v = this.f();
    if (!v.title.trim()) { this.toast.error('Give the course a title.'); return; }
    const body = {
      title: v.title.trim(), slug: v.slug.trim() || null, subtitle: v.subtitle.trim() || null, category: v.category,
      validityDays: v.validityDays === '' ? null : Number(v.validityDays), description: v.description.trim() || null, coverImage: v.coverImage || null,
    };
    const c = this.c();
    this.run(c ? this.api.updateCourse(c.id, body) : this.api.createCourse(body), (x) => {
      this.toast.ok(c ? 'Saved.' : 'Course created. Add a module next.');
      if (!c) this.router.navigate(['/admin/courses', x.id], { replaceUrl: true });
      this.set(x);
    });
  }

  status(s: CourseStatus): void {
    this.run(this.api.setCourseStatus(this.c()!.id, s), (x) => { this.set(x); this.toast.ok(`Course ${s.toLowerCase()}.`); });
  }

  remove(): void {
    if (!confirm('Delete this course and its curriculum? Media files stay in the library.')) return;
    this.run(this.api.deleteCourse(this.c()!.id), () => { this.toast.ok('Course deleted.'); this.router.navigateByUrl('/admin/courses'); });
  }

  addModule(): void {
    const t = this.moduleTitle().trim();
    if (!t) return;
    this.run(this.api.addModule(this.c()!.id, t), (x) => { this.set(x); this.moduleTitle.set(''); });
  }

  renameModule(m: ModuleAdmin, title: string): void {
    if (!title.trim() || title === m.title) return;
    this.run(this.api.renameModule(m.id, title.trim()), (x) => this.set(x));
  }

  deleteModule(m: ModuleAdmin): void {
    if (!confirm(`Delete module “${m.title}” and its ${m.lessons.length} lesson(s)? Learner progress on them is removed.`)) return;
    this.run(this.api.deleteModule(m.id), (x) => this.set(x));
  }

  moveModule(i: number, dir: number): void {
    const ids = this.c()!.modules.map((m) => m.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    this.run(this.api.orderModules(this.c()!.id, ids), (x) => this.set(x));
  }

  moveLesson(m: ModuleAdmin, i: number, dir: number): void {
    const ids = m.lessons.map((l) => l.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    this.run(this.api.orderLessons(m.id, ids), (x) => this.set(x));
  }

  newLesson(m: ModuleAdmin): void {
    this.draft.set({ moduleId: m.id, title: '', type: 'VIDEO', assetId: null, body: '', examId: null, freePreview: false });
  }

  editLesson(m: ModuleAdmin, l: LessonAdmin): void {
    this.draft.set({ id: l.id, moduleId: m.id, title: l.title, type: l.type, assetId: l.assetId ?? null, body: l.body ?? '', examId: l.examId ?? null, freePreview: l.freePreview });
  }

  deleteLesson(l: LessonAdmin): void {
    if (!confirm(`Delete lesson “${l.title}”?`)) return;
    this.run(this.api.deleteLesson(l.id), (x) => this.set(x));
  }

  saveLesson(): void {
    const d = this.draft();
    if (!d) return;
    if (!d.title.trim()) { this.toast.error('Give the lesson a title.'); return; }
    const body: LessonRequest = { title: d.title.trim(), type: d.type, assetId: d.assetId, body: d.body.trim() || null, examId: d.examId, freePreview: d.freePreview };
    this.run(d.id ? this.api.updateLesson(d.id, body) : this.api.addLesson(d.moduleId, body), (x) => {
      this.set(x);
      this.draft.set(null);
      this.toast.ok(d.id ? 'Lesson saved.' : 'Lesson added.');
    });
  }

  private run<T>(obs: Observable<T>, ok: (v: T) => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: (v) => { this.busy.set(false); ok(v); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
