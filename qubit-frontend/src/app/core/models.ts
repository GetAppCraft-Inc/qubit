export type Role = 'QUBIT_USER' | 'QUBIT_ADMIN' | 'QUBIT_SUPERADMIN';
export type ExamCategory = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET_UG' | 'BITSAT' | 'CUET' | 'OTHER';
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type ExamMode = 'PROCTORED' | 'OPEN';
export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'NUMERIC';
export type RegistrationStatus = 'REGISTERED' | 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED' | 'CANCELLED';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'TERMINATED';

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  emailVerified: boolean;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginResponse { token: string; user: User; }
export interface MessageResponse { message: string; }

// ---------- candidate ----------

export interface PublicExam {
  id: number;
  code: string;
  title: string;
  description?: string;
  category: ExamCategory;
  mode: ExamMode;
  durationMinutes: number;
  lateEntryMinutes: number;
  questionCount: number;
  totalMarks: number;
  subjects: string[];
  registrationOpen: boolean;
  registrationClosesAt?: string;
  nextSlotAt?: string;
  myRegistrationId?: number;
}

export interface PublicSlot { id: number; startsAt: string; label?: string; seatsLeft: number; }

export interface PublicExamDetail {
  exam: PublicExam;
  instructions?: string;
  violationTolerance: number;
  slots: PublicSlot[];
}

export interface AttemptBrief {
  id: number;
  status: AttemptStatus;
  startedAt: string;
  endsAt: string;
  finishedAt?: string;
  score?: number;
  maxScore?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  terminationReason?: string;
  resultsVisible: boolean;
}

export interface Registration {
  id: number;
  hallTicketNo: string;
  status: RegistrationStatus;
  createdAt: string;
  exam: {
    id: number; code: string; title: string; category: ExamCategory; mode: ExamMode; durationMinutes: number;
    lateEntryMinutes: number; questionCount: number; totalMarks: number; violationTolerance: number;
    instructions?: string;
  };
  slot: { id: number; startsAt: string; label?: string };
  candidateName: string;
  candidateEmail: string;
  candidateId: number;
  entryOpensAt: string;
  entryClosesAt: string;
  attempt?: AttemptBrief;
  appeal?: AppealBrief;
  canAppeal: boolean;
  retakeUntil?: string;
}

export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AppealBrief {
  id: number; status: AppealStatus; message: string; createdAt: string; decidedAt?: string;
  decisionNote?: string; retakeUntil?: string;
}

// ---------- exam room ----------

export interface PaperQuestion {
  id: number;
  index: number;
  subject: string;
  section?: string;
  type: QuestionType;
  text: string;
  options: string[];
  imageUrl?: string;
  marks: number;
  negativeMarks: number;
  partialMarking: boolean;
}

export interface AnswerState { questionId: number; response?: string | null; markedForReview: boolean; }

export interface Paper {
  attemptId: number;
  registrationId: number;
  mode: ExamMode;
  status: AttemptStatus;
  terminationReason?: string;
  hallTicketNo: string;
  candidateName: string;
  examTitle: string;
  examCode: string;
  durationMinutes: number;
  violationTolerance: number;
  totalMarks: number;
  violationCount: number;
  startedAt: string;
  endsAt: string;
  serverNow: string;
  questions: PaperQuestion[];
  answers: AnswerState[];
}

export interface ViolationOutcome {
  flagged?: boolean;
  counted: boolean;
  terminated: boolean;
  violationCount: number;
  tolerance: number;
  label: string;
  reason?: string;
}

// ---------- admin ----------

export interface Slot { id: number; startsAt: string; capacity: number; label?: string; booked: number; }

export interface AdminQuestion {
  id: number;
  subject: string;
  section?: string;
  type: QuestionType;
  text: string;
  options: string[];
  imageUrl?: string;
  correctAnswer: string;
  marks: number;
  negativeMarks: number;
  position: number;
  partialMarking: boolean;
  answerTolerance?: number;
}

export interface ExamSummary {
  id: number;
  code: string;
  title: string;
  category: ExamCategory;
  status: ExamStatus;
  mode: ExamMode;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  slotCount: number;
  registrationCount: number;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  nextSlotAt?: string;
  createdAt: string;
}

export interface ExamDetail {
  id: number;
  code: string;
  title: string;
  description?: string;
  instructions?: string;
  category: ExamCategory;
  status: ExamStatus;
  mode: ExamMode;
  webhookUrl?: string;
  webhookSecret?: string;
  durationMinutes: number;
  lateEntryMinutes: number;
  violationTolerance: number;
  integrityAction: IntegrityAction;
  showResults: boolean;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  totalMarks: number;
  registrationCount: number;
  locked: boolean;
  slots: Slot[];
  questions: AdminQuestion[];
}

export interface ExamRequest {
  code: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  category: ExamCategory;
  durationMinutes: number;
  lateEntryMinutes: number;
  violationTolerance: number;
  showResults: boolean;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  mode: ExamMode;
  webhookUrl?: string | null;
  integrityAction?: IntegrityAction;
}

export interface QuestionRequest {
  subject: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  marks: number;
  negativeMarks: number;
  position?: number | null;
  section?: string | null;
  imageData?: string | null;
  partialMarking?: boolean;
  answerTolerance?: number | null;
}

export interface Overview {
  exams: number;
  publishedExams: number;
  candidates: number;
  registrations: number;
  liveAttempts: number;
  completedAttempts: number;
  terminatedAttempts: number;
  upcoming: { examId: number; examTitle: string; examCode: string; startsAt: string; booked: number; capacity: number }[];
}

export interface RegistrationRow {
  registrationId: number;
  hallTicketNo: string;
  status: RegistrationStatus;
  examId: number;
  examTitle: string;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  slotStartsAt: string;
  registeredAt: string;
  attemptId?: number;
  attemptStatus?: AttemptStatus;
  startedAt?: string;
  finishedAt?: string;
  score?: number;
  maxScore?: number;
  violationCount?: number;
  terminationReason?: string;
}

export interface LiveAttempt {
  attemptId: number;
  examId: number;
  examTitle: string;
  candidateName: string;
  candidateEmail: string;
  hallTicketNo: string;
  startedAt: string;
  endsAt: string;
  violationCount: number;
  tolerance: number;
  online: boolean;
  ipAddress?: string;
}

export interface ProctorEventRow { id: number; type: string; label: string; counted: boolean; detail?: string; at: string; }

export interface SystemInfo {
  javaVersion: string;
  springBootVersion: string;
  serverTime: string;
  uptimeSeconds: number;
  databaseUp: boolean;
  databaseProduct?: string;
  mailEnabled: boolean;
  liveExamSockets: number;
  monitorSockets: number;
  heapUsedMb: number;
  heapMaxMb: number;
  availableProcessors: number;
}

// ---------- analytics ----------

export interface SubjectScore { subject: string; questions: number; score: number; maxScore: number; correct: number; incorrect: number; unanswered: number; }

export interface QuestionReview {
  id: number; index: number; subject: string; section?: string; type: QuestionType; text: string; options: string[];
  imageUrl?: string; yourResponse?: string; correctAnswer: string; marks: number; negativeMarks: number;
  outcome: 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'UNANSWERED'; awarded: number;
}

export interface AttemptReport {
  registrationId: number; attemptId: number; hallTicketNo: string; examTitle: string; examCode: string;
  category: ExamCategory; mode: ExamMode; status: AttemptStatus; terminationReason?: string;
  startedAt: string; finishedAt: string; secondsTaken: number; durationMinutes: number;
  resultsVisible: boolean; score?: number; maxScore?: number; correct?: number; incorrect?: number; unanswered?: number;
  accuracy?: number; rank?: number; rankedCandidates?: number; percentile?: number; examAverage?: number; examTopScore?: number;
  subjects: SubjectScore[]; reviewAvailable: boolean; reviewAvailableAt?: string; questions: QuestionReview[];
}

export interface HistoryItem {
  registrationId: number; examTitle: string; category: ExamCategory; status: AttemptStatus;
  finishedAt?: string; score?: number; maxScore?: number; percent?: number;
}

export interface CandidateStats {
  attempts: number; completed: number; terminated: number; averagePercent?: number; bestPercent?: number;
  latestPercent?: number; questionsAnswered: number; accuracy?: number;
  history: HistoryItem[]; subjects: { subject: string; attempted: number; correct: number; accuracy: number }[];
}

export interface ExamAnalytics {
  registered: number; started: number; inProgress: number; submitted: number; autoSubmitted: number;
  terminated: number; absent: number; maxScore: number; average?: number; median?: number;
  highest?: number; lowest?: number; stdDev?: number;
  distribution: { from: number; to: number; count: number }[];
  subjects: { subject: string; maxScore: number; averageScore: number; averagePercent: number; accuracy: number }[];
  questions: { id: number; index: number; subject: string; type: QuestionType; excerpt: string; attempted: number; correct: number; attemptRate: number; correctRate: number }[];
  violations: { type: string; label: string; total: number; counted: number }[];
}

export interface WebhookDelivery { ok: boolean; status: number; message: string; }

export const CATEGORY_LABEL: Record<ExamCategory, string> = {
  JEE_MAIN: 'JEE Main',
  JEE_ADVANCED: 'JEE Advanced',
  NEET_UG: 'NEET-UG',
  BITSAT: 'BITSAT',
  CUET: 'CUET',
  OTHER: 'Other',
};

// ---------- LMS ----------

export type LessonType = 'VIDEO' | 'DOCUMENT' | 'ARTICLE' | 'QUIZ';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type MediaKind = 'VIDEO' | 'DOCUMENT' | 'IMAGE';
export type MediaStatus = 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface CourseCard {
  id: number; slug: string; title: string; subtitle?: string; category: ExamCategory; coverImage?: string;
  lessonCount: number; totalDurationSeconds: number; enrolled: boolean; progressPercent?: number;
}
export interface CurriculumLesson { id: number; title: string; type: LessonType; durationSeconds?: number; freePreview: boolean; completed: boolean; locked: boolean; }
export interface CurriculumModule { id: number; title: string; lessons: CurriculumLesson[]; }
export interface CourseDetail {
  course: CourseCard; description?: string; validityDays?: number;
  enrollment?: { enrolledAt: string; expiresAt?: string; active: boolean };
  modules: CurriculumModule[]; nextLessonId?: number;
}
export interface MyCourse {
  course: CourseCard; enrolledAt: string; expiresAt?: string; lastAccessedAt?: string;
  completedLessons: number; nextLessonId?: number; nextLessonTitle?: string;
}
export interface LessonView {
  id: number; title: string; type: LessonType; courseSlug: string; courseTitle: string; moduleTitle: string;
  body?: string; durationSeconds?: number; documentUrl?: string; posterUrl?: string;
  quiz?: { examId: number; examTitle: string; mode: ExamMode; registrationId?: number; attemptStatus?: string };
  lastPositionSeconds: number; completed: boolean; prevLessonId?: number; nextLessonId?: number;
  curriculum: CurriculumModule[]; progressPercent: number;
}
export interface PlaybackInfo {
  token: string; manifestUrl: string; posterUrl?: string; durationSeconds?: number; renditions: number[];
  resumeAt: number; watermark: string; expiresAt: string;
}

export interface MediaItem {
  id: number; kind: MediaKind; status: MediaStatus; title: string; originalName: string; contentType: string;
  sizeBytes: number; progress: number; error?: string; durationSeconds?: number; width?: number; height?: number;
  renditions: number[]; encoder?: string; posterUrl?: string; createdAt: string; readyAt?: string; inUse: boolean;
}
export interface UploadPlan { assetId: number; partSize: number; partUrls: string[]; }

export interface LessonAdmin {
  id: number; title: string; type: LessonType; position: number; assetId?: number; assetTitle?: string;
  assetStatus?: MediaStatus; durationSeconds?: number; body?: string; examId?: number; examTitle?: string; freePreview: boolean;
}
export interface ModuleAdmin { id: number; title: string; position: number; lessons: LessonAdmin[]; }
export interface CourseAdmin {
  id: number; slug: string; title: string; subtitle?: string; description?: string; category: ExamCategory;
  status: CourseStatus; coverImage?: string; validityDays?: number; enrollments: number; lessonCount: number;
  totalDurationSeconds: number; createdAt: string; modules: ModuleAdmin[];
}
export interface CourseSummary {
  id: number; slug: string; title: string; category: ExamCategory; status: CourseStatus; moduleCount: number;
  lessonCount: number; totalDurationSeconds: number; enrollments: number; createdAt: string;
}
export interface CourseRequest {
  title: string; slug?: string | null; subtitle?: string | null; description?: string | null; category: ExamCategory;
  validityDays?: number | null; coverImage?: string | null;
}
export interface LessonRequest { title: string; type: LessonType; assetId?: number | null; body?: string | null; examId?: number | null; freePreview: boolean; }

// ---------- integrity: invigilator review & appeals ----------

export type IntegrityAction = 'REVIEW' | 'TERMINATE';
export type CaseStatus = 'OPEN' | 'DISMISSED' | 'CANCELLED' | 'AUTO_TERMINATED';

export interface IntegrityCaseRow {
  id: number; status: CaseStatus; reason: string; violationCount: number; tolerance: number;
  openedAt: string; updatedAt?: string; decidedAt?: string; decidedBy?: string; decisionNote?: string;
  attemptId: number; attemptStatus: AttemptStatus; online: boolean; examId: number; examTitle: string; examCode: string;
  candidateName: string; candidateEmail: string; hallTicketNo: string;
}

export interface AppealRow {
  id: number; status: AppealStatus; message: string; createdAt: string; decidedAt?: string; decidedBy?: string;
  decisionNote?: string; retakeUntil?: string; attemptId: number; registrationId: number; terminationReason?: string;
  violationCount: number; attemptStartedAt: string; attemptFinishedAt?: string; examId: number; examTitle: string;
  examCode: string; candidateName: string; candidateEmail: string; hallTicketNo: string;
}

export interface IntegritySummary { openCases: number; pendingAppeals: number; }
