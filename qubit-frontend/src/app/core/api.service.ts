import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AdminQuestion, ExamDetail, ExamRequest, ExamSummary, LiveAttempt, Overview, Paper, ProctorEventRow,
  PublicExam, PublicExamDetail, QuestionRequest, Registration, RegistrationRow, Role, SystemInfo, User,
  ViolationOutcome, AttemptStatus, AttemptReport, CandidateStats, ExamAnalytics, WebhookDelivery,
  CourseCard, CourseDetail, MyCourse, LessonView, PlaybackInfo, CourseSummary, CourseAdmin, CourseRequest, CourseStatus,
  LessonRequest, MediaItem, UploadPlan, IntegritySummary, IntegrityCaseRow, AppealRow,
} from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  // ---------- candidate ----------
  exams() { return this.http.get<PublicExam[]>('/api/exams'); }
  exam(id: number) { return this.http.get<PublicExamDetail>(`/api/exams/${id}`); }
  register(examId: number, slotId: number | null) { return this.http.post<Registration>(`/api/exams/${examId}/register`, { slotId }); }
  registrations() { return this.http.get<Registration[]>('/api/registrations'); }
  registration(id: number) { return this.http.get<Registration>(`/api/registrations/${id}`); }
  reschedule(id: number, slotId: number) { return this.http.put<Registration>(`/api/registrations/${id}/slot`, { slotId }); }

  // ---------- exam room ----------
  startAttempt(registrationId: number, clientSessionId: string) {
    return this.http.post<Paper>(`/api/registrations/${registrationId}/attempt`, { clientSessionId });
  }
  saveAnswer(attemptId: number, questionId: number, response: string | null, markedForReview: boolean) {
    return this.http.put<{ savedAt: string }>(`/api/attempts/${attemptId}/answers/${questionId}`, { response, markedForReview });
  }
  submit(attemptId: number) {
    return this.http.post<{ status: AttemptStatus; terminationReason?: string }>(`/api/attempts/${attemptId}/submit`, {});
  }
  reportEvent(attemptId: number, type: string, detail?: string) {
    return this.http.post<ViolationOutcome>(`/api/attempts/${attemptId}/events`, { type, detail });
  }

  // ---------- admin ----------
  overview() { return this.http.get<Overview>('/api/admin/overview'); }
  adminExams() { return this.http.get<ExamSummary[]>('/api/admin/exams'); }
  adminExam(id: number) { return this.http.get<ExamDetail>(`/api/admin/exams/${id}`); }
  createExam(body: ExamRequest) { return this.http.post<ExamDetail>('/api/admin/exams', body); }
  updateExam(id: number, body: ExamRequest) { return this.http.put<ExamDetail>(`/api/admin/exams/${id}`, body); }
  deleteExam(id: number) { return this.http.delete<void>(`/api/admin/exams/${id}`); }
  setExamStatus(id: number, action: 'publish' | 'unpublish' | 'close') {
    return this.http.post<ExamDetail>(`/api/admin/exams/${id}/${action}`, {});
  }
  addSlot(examId: number, body: { startsAt: string; capacity: number; label?: string }) {
    return this.http.post<ExamDetail>(`/api/admin/exams/${examId}/slots`, body);
  }
  deleteSlot(slotId: number) { return this.http.delete<ExamDetail>(`/api/admin/slots/${slotId}`); }
  addQuestion(examId: number, body: QuestionRequest) { return this.http.post<ExamDetail>(`/api/admin/exams/${examId}/questions`, body); }
  addQuestionsBulk(examId: number, body: QuestionRequest[]) {
    return this.http.post<ExamDetail>(`/api/admin/exams/${examId}/questions/bulk`, body);
  }
  updateQuestion(q: AdminQuestion | number, body: QuestionRequest) {
    const id = typeof q === 'number' ? q : q.id;
    return this.http.put<ExamDetail>(`/api/admin/questions/${id}`, body);
  }
  deleteQuestion(id: number) { return this.http.delete<ExamDetail>(`/api/admin/questions/${id}`); }
  examRegistrations(examId: number) { return this.http.get<RegistrationRow[]>(`/api/admin/exams/${examId}/registrations`); }
  liveAttempts() { return this.http.get<LiveAttempt[]>('/api/admin/attempts/live'); }
  attemptEvents(attemptId: number) { return this.http.get<ProctorEventRow[]>(`/api/admin/attempts/${attemptId}/events`); }
  terminateAttempt(attemptId: number, reason: string) {
    return this.http.post<{ terminated: boolean }>(`/api/admin/attempts/${attemptId}/terminate`, { reason });
  }

  // ---------- integrity ----------
  integritySummary() { return this.http.get<IntegritySummary>('/api/admin/integrity/summary'); }
  integrityCases(status = 'OPEN') { return this.http.get<IntegrityCaseRow[]>('/api/admin/integrity/cases', { params: { status } }); }
  cancelCase(id: number, note: string) { return this.http.post<IntegrityCaseRow>(`/api/admin/integrity/cases/${id}/cancel`, { note }); }
  dismissCase(id: number, note: string) { return this.http.post<IntegrityCaseRow>(`/api/admin/integrity/cases/${id}/dismiss`, { note }); }
  appeals() { return this.http.get<AppealRow[]>('/api/admin/appeals'); }
  approveAppeal(id: number, note: string, hours: number) { return this.http.post<AppealRow>(`/api/admin/appeals/${id}/approve`, { note, hours }); }
  rejectAppeal(id: number, note: string) { return this.http.post<AppealRow>(`/api/admin/appeals/${id}/reject`, { note }); }
  submitAppeal(registrationId: number, message: string) {
    return this.http.post<AppealRow>(`/api/registrations/${registrationId}/appeal`, { message });
  }
  hallTicket(no: string) { return this.http.get<RegistrationRow>(`/api/admin/hall-tickets/${encodeURIComponent(no)}`); }

  examAnalytics(examId: number) { return this.http.get<ExamAnalytics>(`/api/admin/exams/${examId}/analytics`); }
  testWebhook(examId: number) { return this.http.post<WebhookDelivery>(`/api/admin/exams/${examId}/webhook/test`, {}); }
  rotateWebhook(examId: number) { return this.http.post<ExamDetail>(`/api/admin/exams/${examId}/webhook/rotate`, {}); }

  // ---------- results & account ----------
  report(registrationId: number) { return this.http.get<AttemptReport>(`/api/registrations/${registrationId}/report`); }
  myStats() { return this.http.get<CandidateStats>('/api/me/stats'); }
  updateProfile(body: { fullName: string; phone?: string | null }) { return this.http.put<User>('/api/me', body); }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ message: string }>('/api/me/password', { currentPassword, newPassword });
  }

  // ---------- LMS: learner ----------
  courses() { return this.http.get<CourseCard[]>('/api/courses'); }
  course(slug: string) { return this.http.get<CourseDetail>(`/api/courses/${encodeURIComponent(slug)}`); }
  enroll(slug: string) { return this.http.post<CourseDetail>(`/api/courses/${encodeURIComponent(slug)}/enroll`, {}); }
  myCourses() { return this.http.get<MyCourse[]>('/api/learn'); }
  lesson(id: number) { return this.http.get<LessonView>(`/api/learn/lessons/${id}`); }
  completeLesson(id: number, completed = true) { return this.http.post<LessonView>(`/api/learn/lessons/${id}/complete`, { completed }); }
  startPlayback(lessonId: number, deviceId: string) { return this.http.post<PlaybackInfo>(`/api/learn/lessons/${lessonId}/playback`, { deviceId }); }
  previewMedia(assetId: number, deviceId: string) { return this.http.post<PlaybackInfo>(`/api/admin/media/${assetId}/preview`, { deviceId }); }
  heartbeat(token: string, position: number, watchedDelta: number, ended: boolean) {
    return this.http.post<void>(`/api/media/play/${token}/heartbeat`, { position, watchedDelta, ended });
  }
  endPlayback(token: string) { return this.http.delete<void>(`/api/media/play/${token}`); }

  // ---------- LMS: admin ----------
  adminCourses() { return this.http.get<CourseSummary[]>('/api/admin/courses'); }
  adminCourse(id: number) { return this.http.get<CourseAdmin>(`/api/admin/courses/${id}`); }
  createCourse(body: CourseRequest) { return this.http.post<CourseAdmin>('/api/admin/courses', body); }
  updateCourse(id: number, body: CourseRequest) { return this.http.put<CourseAdmin>(`/api/admin/courses/${id}`, body); }
  deleteCourse(id: number) { return this.http.delete<void>(`/api/admin/courses/${id}`); }
  setCourseStatus(id: number, status: CourseStatus) { return this.http.post<CourseAdmin>(`/api/admin/courses/${id}/status/${status}`, {}); }
  addModule(courseId: number, title: string) { return this.http.post<CourseAdmin>(`/api/admin/courses/${courseId}/modules`, { title }); }
  renameModule(moduleId: number, title: string) { return this.http.put<CourseAdmin>(`/api/admin/courses/modules/${moduleId}`, { title }); }
  deleteModule(moduleId: number) { return this.http.delete<CourseAdmin>(`/api/admin/courses/modules/${moduleId}`); }
  orderModules(courseId: number, ids: number[]) { return this.http.put<CourseAdmin>(`/api/admin/courses/${courseId}/modules/order`, { ids }); }
  addLesson(moduleId: number, body: LessonRequest) { return this.http.post<CourseAdmin>(`/api/admin/courses/modules/${moduleId}/lessons`, body); }
  updateLesson(lessonId: number, body: LessonRequest) { return this.http.put<CourseAdmin>(`/api/admin/courses/lessons/${lessonId}`, body); }
  deleteLesson(lessonId: number) { return this.http.delete<CourseAdmin>(`/api/admin/courses/lessons/${lessonId}`); }
  orderLessons(moduleId: number, ids: number[]) { return this.http.put<CourseAdmin>(`/api/admin/courses/modules/${moduleId}/lessons/order`, { ids }); }

  media() { return this.http.get<MediaItem[]>('/api/admin/media'); }
  mediaItem(id: number) { return this.http.get<MediaItem>(`/api/admin/media/${id}`); }
  startUpload(body: { fileName: string; size: number; contentType: string; title?: string }) { return this.http.post<UploadPlan>('/api/admin/media/uploads', body); }
  completeUpload(id: number, parts: { partNumber: number; etag: string }[]) { return this.http.post<MediaItem>(`/api/admin/media/${id}/complete`, { parts }); }
  renameMedia(id: number, title: string) { return this.http.patch<MediaItem>(`/api/admin/media/${id}`, { title }); }
  retryMedia(id: number) { return this.http.post<MediaItem>(`/api/admin/media/${id}/retry`, {}); }
  deleteMedia(id: number) { return this.http.delete<void>(`/api/admin/media/${id}`); }

  // ---------- superadmin ----------
  users() { return this.http.get<User[]>('/api/super/users'); }
  patchUser(id: number, body: { role?: Role; active?: boolean }) { return this.http.patch<User>(`/api/super/users/${id}`, body); }
  system() { return this.http.get<SystemInfo>('/api/super/system'); }
}

export function wsUrl(path: string, params: Record<string, string | number>): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return `${proto}://${location.host}${path}?${qs}`;
}
