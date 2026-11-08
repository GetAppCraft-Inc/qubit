import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Api } from '../core/api.service';
import { DurationPipe, errorMessage, fromLocalInput, IstPipe, optionLetter, toLocalInput } from '../core/format';
import {
  AdminQuestion, CATEGORY_LABEL, ExamAnalytics, ExamCategory, ExamDetail, ExamMode, ExamRequest, QuestionRequest,
  QuestionType, RegistrationRow, WebhookDelivery,
  IntegrityAction,
} from '../core/models';
import { ToastService } from '../core/toast.service';
import { ColumnChart, Datum } from '../shared/charts';
import { MathText } from '../shared/math-text';
import { attemptBadge, examStatusBadge, regStatusBadge } from '../shared/status';

type Tab = 'details' | 'questions' | 'slots' | 'candidates' | 'analytics';

interface QuestionDraft {
  id?: number;
  subject: string;
  type: QuestionType;
  text: string;
  options: string[];
  correct: number[];
  numeric: string;
  marks: number;
  negativeMarks: number;
  section: string;
  imageData: string | null;
  partialMarking: boolean;
  tolerance: string;
}

const MAX_IMAGE_BYTES = 1_200_000;

interface Confirm { title: string; body: string; cta: string; danger?: boolean; run: () => void; }

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology', 'English', 'Logical Reasoning', 'General Aptitude'];

const SAMPLE_JSON = `[
  {
    "subject": "Physics",
    "type": "SINGLE",
    "text": "A body starts from rest with uniform acceleration 2 m/s². Distance covered in 5 s is",
    "options": ["10 m", "20 m", "25 m", "50 m"],
    "correctAnswer": "2",
    "marks": 4,
    "negativeMarks": 1
  },
  {
    "subject": "Mathematics",
    "type": "NUMERIC",
    "text": "The number of diagonals of a regular decagon is",
    "options": [],
    "correctAnswer": "35",
    "marks": 4,
    "negativeMarks": 0
  }
]`;

@Component({
  selector: 'app-exam-editor',
  imports: [ReactiveFormsModule, RouterLink, IstPipe, DurationPipe, ColumnChart, MathText],
  templateUrl: './exam-editor.html',
  styleUrl: './exam-editor.scss',
})
export class ExamEditor implements OnInit {
  private api = inject(Api);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toast = inject(ToastService);

  /** Route param (absent on /admin/exams/new) and optional ?tab= query param. */
  id = input<string>();
  tabParam = input<string>(undefined, { alias: 'tab' });

  protected readonly labels = CATEGORY_LABEL;
  protected readonly categories = Object.keys(CATEGORY_LABEL) as ExamCategory[];
  protected readonly subjects = SUBJECTS;
  protected readonly sample = SAMPLE_JSON;
  protected readonly letter = optionLetter;

  protected exam = signal<ExamDetail | null>(null);
  protected loading = signal(false);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected tab = signal<Tab>('details');
  protected confirm = signal<Confirm | null>(null);

  protected draft = signal<QuestionDraft | null>(null);
  protected importOpen = signal(false);
  protected importText = signal('');
  protected importError = signal<string | null>(null);

  protected slotStart = signal('');
  protected slotCapacity = signal(100);
  protected slotLabel = signal('');

  protected candidates = signal<RegistrationRow[] | null>(null);

  protected isNew = computed(() => !this.id());
  protected statusBadge = computed(() => (this.exam() ? examStatusBadge(this.exam()!.status) : null));
  protected subjectBreakdown = computed(() => {
    const map = new Map<string, { count: number; marks: number }>();
    for (const q of this.exam()?.questions ?? []) {
      const e = map.get(q.subject) ?? { count: 0, marks: 0 };
      e.count++;
      e.marks += q.marks;
      map.set(q.subject, e);
    }
    return [...map.entries()].map(([subject, v]) => ({ subject, ...v }));
  });

  protected form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]+$/), Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    category: ['JEE_MAIN' as ExamCategory, Validators.required],
    durationMinutes: [180, [Validators.required, Validators.min(5), Validators.max(600)]],
    lateEntryMinutes: [15, [Validators.required, Validators.min(0), Validators.max(120)]],
    violationTolerance: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
    integrityAction: ['REVIEW' as IntegrityAction],
    showResults: [true],
    registrationOpensAt: [''],
    registrationClosesAt: [''],
    description: [''],
    instructions: [''],
    mode: ['PROCTORED' as ExamMode],
    webhookUrl: ['', Validators.pattern(/^(https?:\/\/\S+)?$/)],
  });

  protected analytics = signal<ExamAnalytics | null>(null);
  protected hookResult = signal<WebhookDelivery | null>(null);
  protected secretVisible = signal(false);

  protected distribution = computed<Datum[]>(() =>
    (this.analytics()?.distribution ?? []).map((b) => ({
      label: `${b.from}`,
      value: b.count,
      tip: `${b.count} candidate${b.count === 1 ? '' : 's'} scored ${b.from}–${b.to}% of max`,
    })),
  );
  protected hardest = computed(() =>
    (this.analytics()?.questions ?? []).filter((q) => q.attempted > 0).slice().sort((a, b) => a.correctRate - b.correctRate),
  );
  protected shareLink = computed(() => (this.exam() ? `${location.origin}/app/exams/${this.exam()!.id}` : ''));

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.loading.set(true);
      this.api.adminExam(+id).subscribe({
        next: (e) => {
          this.setExam(e);
          this.loading.set(false);
          const t = this.tabParam();
          if (t === 'questions' || t === 'slots' || t === 'candidates' || t === 'analytics') this.openTab(t);
        },
        error: (err) => { this.error.set(errorMessage(err)); this.loading.set(false); },
      });
    }
  }

  // ------------------------------------------------------------ tabs

  openTab(t: Tab): void {
    if (this.isNew() && t !== 'details') return;
    this.tab.set(t);
    if (t === 'candidates') this.loadCandidates();
    if (t === 'analytics') this.loadAnalytics();
  }

  private loadAnalytics(): void {
    const e = this.exam();
    if (!e) return;
    this.analytics.set(null);
    this.api.examAnalytics(e.id).subscribe({
      next: (a) => this.analytics.set(a),
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  // ------------------------------------------------------------ integrations

  testWebhook(): void {
    const e = this.exam();
    if (!e) return;
    this.hookResult.set(null);
    this.run(this.api.testWebhook(e.id), (r) => this.hookResult.set(r));
  }

  rotateSecret(): void {
    const e = this.exam();
    if (!e) return;
    this.confirm.set({
      title: 'Rotate signing secret?',
      body: 'The old secret stops working immediately. Update your receiving app with the new one.',
      cta: 'Rotate',
      run: () => this.run(this.api.rotateWebhook(e.id), (x) => { this.exam.set(x); this.secretVisible.set(true); this.toast.ok('Secret rotated.'); }),
    });
  }

  copy(text: string, what: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.ok(`${what} copied.`),
      () => this.toast.error('Copy failed — select and copy it manually.'),
    );
  }

  pctOf(n: number, d: number): number { return d > 0 ? Math.round((100 * n) / d) : 0; }

  private loadCandidates(): void {
    const e = this.exam();
    if (!e) return;
    this.api.examRegistrations(e.id).subscribe({
      next: (rows) => this.candidates.set(rows),
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  // ------------------------------------------------------------ details

  private setExam(e: ExamDetail): void {
    this.exam.set(e);
    this.form.reset({
      code: e.code,
      title: e.title,
      category: e.category,
      durationMinutes: e.durationMinutes,
      lateEntryMinutes: e.lateEntryMinutes,
      violationTolerance: e.violationTolerance,
      integrityAction: e.integrityAction ?? 'REVIEW',
      showResults: e.showResults,
      registrationOpensAt: toLocalInput(e.registrationOpensAt),
      registrationClosesAt: toLocalInput(e.registrationClosesAt),
      description: e.description ?? '',
      instructions: e.instructions ?? '',
      mode: e.mode ?? 'PROCTORED',
      webhookUrl: e.webhookUrl ?? '',
    });
  }

  saveDetails(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Check the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const body: ExamRequest = {
      ...v,
      code: v.code.trim().toUpperCase(),
      registrationOpensAt: fromLocalInput(v.registrationOpensAt),
      registrationClosesAt: fromLocalInput(v.registrationClosesAt),
      description: v.description.trim() || null,
      instructions: v.instructions.trim() || null,
      webhookUrl: v.webhookUrl.trim() || null,
    };
    this.busy.set(true);
    const e = this.exam();
    const req = e ? this.api.updateExam(e.id, body) : this.api.createExam(body);
    req.subscribe({
      next: (saved) => {
        this.busy.set(false);
        if (!e) {
          this.toast.ok('Exam created. Now add questions.');
          this.router.navigate(['/admin/exams', saved.id], { queryParams: { tab: 'questions' }, replaceUrl: true });
        } else {
          this.setExam(saved);
          this.toast.ok('Details saved.');
        }
      },
      error: (err) => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  // ------------------------------------------------------------ status

  setStatus(action: 'publish' | 'unpublish' | 'close'): void {
    const e = this.exam();
    if (!e) return;
    const copy = {
      publish: { title: 'Publish this exam?', body: 'Candidates will be able to see it and register for its slots.', cta: 'Publish' },
      unpublish: { title: 'Move back to draft?', body: 'The exam will be hidden from candidates.', cta: 'Move to draft' },
      close: { title: 'Close this exam?', body: 'Registration stops and no new attempts can begin. Attempts already running will finish normally.', cta: 'Close exam' },
    }[action];
    this.confirm.set({
      ...copy,
      danger: action === 'close',
      run: () => this.run(this.api.setExamStatus(e.id, action), (x) => { this.setExam(x); this.toast.ok('Status updated.'); }),
    });
  }

  deleteExam(): void {
    const e = this.exam();
    if (!e) return;
    this.confirm.set({
      title: 'Delete this exam?',
      body: `“${e.title}” and all its questions and slots will be removed. This can't be undone.`,
      cta: 'Delete exam',
      danger: true,
      run: () => this.run(this.api.deleteExam(e.id), () => { this.toast.ok('Exam deleted.'); this.router.navigateByUrl('/admin/exams'); }),
    });
  }

  runConfirm(): void {
    const c = this.confirm();
    this.confirm.set(null);
    c?.run();
  }

  private run<T>(obs: Observable<T>, ok: (v: T) => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: (v) => { this.busy.set(false); ok(v); },
      error: (err) => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  // ------------------------------------------------------------ questions

  newQuestion(): void {
    const e = this.exam();
    const last = e?.questions[e.questions.length - 1];
    const bitsat = e?.category === 'BITSAT';
    this.draft.set({
      subject: last?.subject ?? 'Physics',
      type: 'SINGLE',
      text: '',
      options: ['', '', '', ''],
      correct: [],
      numeric: '',
      marks: last?.marks ?? (bitsat ? 3 : 4),
      negativeMarks: last?.negativeMarks ?? 1,
      section: last?.section ?? '',
      imageData: null,
      partialMarking: last?.type === 'MULTIPLE' ? last.partialMarking : e?.category === 'JEE_ADVANCED',
      tolerance: '',
    });
  }

  editQuestion(q: AdminQuestion): void {
    this.draft.set({
      id: q.id,
      subject: q.subject,
      type: q.type,
      text: q.text,
      options: q.type === 'NUMERIC' ? ['', '', '', ''] : [...q.options],
      correct: q.type === 'NUMERIC' ? [] : q.correctAnswer.split(',').map(Number),
      numeric: q.type === 'NUMERIC' ? q.correctAnswer : '',
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      section: q.section ?? '',
      imageData: q.imageUrl ?? null,
      partialMarking: q.partialMarking,
      tolerance: q.answerTolerance ? String(q.answerTolerance) : '',
    });
  }

  onImagePicked(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.toast.error('Choose an image file (PNG, JPEG, SVG…).'); return; }
    if (file.size > MAX_IMAGE_BYTES) { this.toast.error('Image is larger than 1.2 MB. Crop or compress it first.'); return; }
    const reader = new FileReader();
    reader.onload = () => this.patchDraft({ imageData: String(reader.result) });
    reader.readAsDataURL(file);
  }

  patchDraft(patch: Partial<QuestionDraft>): void {
    this.draft.update((d) => (d ? { ...d, ...patch } : d));
  }

  setType(type: QuestionType): void {
    this.draft.update((d) => {
      if (!d) return d;
      const correct = type === 'SINGLE' ? d.correct.slice(0, 1) : d.correct;
      return { ...d, type, correct };
    });
  }

  setOption(i: number, value: string): void {
    this.draft.update((d) => (d ? { ...d, options: d.options.map((o, j) => (j === i ? value : o)) } : d));
  }

  addOption(): void {
    this.draft.update((d) => (d && d.options.length < 8 ? { ...d, options: [...d.options, ''] } : d));
  }

  removeOption(i: number): void {
    this.draft.update((d) => {
      if (!d || d.options.length <= 2) return d;
      const correct = d.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
      return { ...d, options: d.options.filter((_, j) => j !== i), correct };
    });
  }

  toggleCorrect(i: number): void {
    this.draft.update((d) => {
      if (!d) return d;
      if (d.type === 'SINGLE') return { ...d, correct: [i] };
      const set = new Set(d.correct);
      if (set.has(i)) set.delete(i); else set.add(i);
      return { ...d, correct: [...set].sort((a, b) => a - b) };
    });
  }

  saveQuestion(): void {
    const d = this.draft();
    const e = this.exam();
    if (!d || !e) return;
    if (!d.subject.trim() || !d.text.trim()) { this.toast.error('Subject and question text are required.'); return; }
    let options: string[] = [];
    let correctAnswer = '';
    if (d.type === 'NUMERIC') {
      if (d.numeric.trim() === '' || isNaN(Number(d.numeric))) { this.toast.error('Enter the numeric answer.'); return; }
      correctAnswer = d.numeric.trim();
    } else {
      // Drop blank options while remapping the correct indices.
      const keep: number[] = [];
      d.options.forEach((o, i) => { if (o.trim()) keep.push(i); });
      options = keep.map((i) => d.options[i].trim());
      const mapped = d.correct.filter((c) => keep.includes(c)).map((c) => keep.indexOf(c));
      if (options.length < 2) { this.toast.error('Add at least two options.'); return; }
      if (mapped.length === 0) { this.toast.error('Mark the correct option.'); return; }
      correctAnswer = mapped.join(',');
    }
    const tol = Number(d.tolerance);
    const body: QuestionRequest = {
      subject: d.subject.trim(), type: d.type, text: d.text.trim(), options, correctAnswer,
      marks: Number(d.marks), negativeMarks: Number(d.negativeMarks),
      section: d.section.trim() || null,
      // Existing figures come back as URLs: tell the server to keep them unless replaced/removed.
      imageData: d.imageData && !d.imageData.startsWith('data:') ? 'keep' : d.imageData,
      partialMarking: d.type === 'MULTIPLE' && d.partialMarking,
      answerTolerance: d.type === 'NUMERIC' && d.tolerance.trim() && !isNaN(tol) && tol > 0 ? tol : null,
    };
    const req = d.id ? this.api.updateQuestion(d.id, body) : this.api.addQuestion(e.id, body);
    this.run(req, (x) => {
      this.exam.set(x);
      this.toast.ok(d.id ? 'Question updated.' : 'Question added.');
      if (d.id) this.draft.set(null);
      else this.draft.set({ ...d, text: '', options: d.type === 'NUMERIC' ? d.options : d.options.map(() => ''), correct: [], numeric: '', imageData: null });
    });
  }

  deleteQuestion(q: AdminQuestion, index: number): void {
    this.confirm.set({
      title: `Delete question ${index + 1}?`,
      body: q.text.length > 140 ? q.text.slice(0, 140) + '…' : q.text,
      cta: 'Delete',
      danger: true,
      run: () => this.run(this.api.deleteQuestion(q.id), (x) => { this.exam.set(x); this.toast.ok('Question deleted.'); }),
    });
  }

  answerText(q: AdminQuestion): string {
    if (q.type === 'NUMERIC') return q.correctAnswer;
    return q.correctAnswer.split(',').map((i) => optionLetter(Number(i))).join(', ');
  }

  importQuestions(): void {
    const e = this.exam();
    if (!e) return;
    this.importError.set(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.importText());
    } catch {
      this.importError.set('That isn’t valid JSON.');
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      this.importError.set('Paste a JSON array with at least one question.');
      return;
    }
    const items = parsed as Partial<QuestionRequest>[];
    const bad = items.findIndex((q) => !q || !q.subject || !q.type || !q.text || q.correctAnswer === undefined);
    if (bad >= 0) {
      this.importError.set(`Item ${bad + 1} is missing subject, type, text or correctAnswer.`);
      return;
    }
    const body: QuestionRequest[] = items.map((q) => ({
      subject: String(q.subject), type: q.type as QuestionType, text: String(q.text), options: (q.options ?? []).map(String),
      correctAnswer: String(q.correctAnswer), marks: Number(q.marks ?? 4), negativeMarks: Number(q.negativeMarks ?? 1),
      section: q.section ?? null, imageData: q.imageData ?? null,
      partialMarking: !!q.partialMarking, answerTolerance: q.answerTolerance ?? null,
    }));
    this.busy.set(true);
    this.api.addQuestionsBulk(e.id, body).subscribe({
      next: (x) => {
        this.busy.set(false);
        this.exam.set(x);
        this.importOpen.set(false);
        this.importText.set('');
        this.toast.ok(`Imported ${body.length} question${body.length === 1 ? '' : 's'}.`);
      },
      error: (err) => { this.busy.set(false); this.importError.set(errorMessage(err)); },
    });
  }

  // ------------------------------------------------------------ slots

  addSlot(): void {
    const e = this.exam();
    const iso = fromLocalInput(this.slotStart());
    if (!e || !iso) { this.toast.error('Pick a start date and time.'); return; }
    this.run(this.api.addSlot(e.id, { startsAt: iso, capacity: Number(this.slotCapacity()) || 1, label: this.slotLabel().trim() || undefined }), (x) => {
      this.exam.set(x);
      this.slotStart.set('');
      this.slotLabel.set('');
      this.toast.ok('Slot added.');
    });
  }

  deleteSlot(slotId: number): void {
    this.run(this.api.deleteSlot(slotId), (x) => { this.exam.set(x); this.toast.ok('Slot removed.'); });
  }

  slotEnd(startIso: string): string {
    const e = this.exam();
    return new Date(Date.parse(startIso) + (e?.durationMinutes ?? 0) * 60000).toISOString();
  }

  // ------------------------------------------------------------ candidates

  regBadge(r: RegistrationRow) {
    return r.attemptStatus ? attemptBadge(r.attemptStatus) : regStatusBadge(r.status);
  }

  exportCsv(): void {
    const rows = this.candidates() ?? [];
    const e = this.exam();
    const header = ['Hall ticket', 'Name', 'Email', 'Slot (UTC)', 'Status', 'Attempt', 'Score', 'Max', 'Violations', 'Reason'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.hallTicketNo, r.candidateName, r.candidateEmail, r.slotStartsAt, r.status, r.attemptStatus,
      r.score, r.maxScore, r.violationCount, r.terminationReason].map(esc).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${e?.code ?? 'exam'}-candidates.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
