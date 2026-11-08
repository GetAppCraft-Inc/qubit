import { Routes } from '@angular/router';
import { authGuard, guestGuard, staffGuard, superGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    title: 'Qubit — Timed, proctored mock tests for JEE & NEET',
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    title: 'Sign in · Qubit',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Create account · Qubit',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    title: 'Reset password · Qubit',
    loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    title: 'Choose a new password · Qubit',
    loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'check-email',
    title: 'Check your inbox · Qubit',
    loadComponent: () => import('./auth/check-email').then((m) => m.CheckEmailPage),
  },
  {
    path: 'verify-email',
    title: 'Confirm email · Qubit',
    loadComponent: () => import('./auth/verify-email').then((m) => m.VerifyEmailPage),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./candidate/candidate-shell').then((m) => m.CandidateShell),
    children: [
      { path: '', title: 'Dashboard · Qubit', loadComponent: () => import('./candidate/dashboard').then((m) => m.Dashboard) },
      { path: 'exams', title: 'Assessments · Qubit', loadComponent: () => import('./candidate/exam-list').then((m) => m.ExamList) },
      { path: 'exams/:id', title: 'Assessment · Qubit', loadComponent: () => import('./candidate/exam-detail').then((m) => m.ExamDetailPage) },
      { path: 'registrations', title: 'My registrations · Qubit', loadComponent: () => import('./candidate/registrations').then((m) => m.RegistrationsPage) },
      { path: 'registrations/:id', title: 'Hall ticket · Qubit', loadComponent: () => import('./candidate/hall-ticket').then((m) => m.HallTicketPage) },
      { path: 'results', title: 'Results · Qubit', loadComponent: () => import('./candidate/results').then((m) => m.ResultsPage) },
      { path: 'results/:id', title: 'Score report · Qubit', loadComponent: () => import('./candidate/report').then((m) => m.ReportPage) },
      { path: 'account', title: 'Account · Qubit', loadComponent: () => import('./candidate/account').then((m) => m.AccountPage) },
      { path: 'courses', title: 'Courses · Qubit', loadComponent: () => import('./learn/courses').then((m) => m.CoursesPage) },
      { path: 'courses/:slug', title: 'Course · Qubit', loadComponent: () => import('./learn/course-detail').then((m) => m.CourseDetailPage) },
      { path: 'learn', title: 'My learning · Qubit', loadComponent: () => import('./learn/my-learning').then((m) => m.MyLearningPage) },
      { path: 'learn/lesson/:id', title: 'Lesson · Qubit', loadComponent: () => import('./learn/lesson').then((m) => m.LessonPage) },
    ],
  },
  {
    path: 'exam/:registrationId',
    title: 'Exam · Qubit',
    canActivate: [authGuard],
    // While a paper is running, in-app navigation (back button, links) is blocked.
    canDeactivate: [(c: { canLeave?: () => boolean }) => c.canLeave?.() ?? true],
    loadComponent: () => import('./exam-room/exam-room').then((m) => m.ExamRoom),
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', title: 'Overview · Qubit Admin', loadComponent: () => import('./admin/overview').then((m) => m.OverviewPage) },
      { path: 'exams', title: 'Exams · Qubit Admin', loadComponent: () => import('./admin/exams').then((m) => m.AdminExams) },
      { path: 'exams/new', title: 'New exam · Qubit Admin', loadComponent: () => import('./admin/exam-editor').then((m) => m.ExamEditor) },
      { path: 'exams/:id', title: 'Edit exam · Qubit Admin', loadComponent: () => import('./admin/exam-editor').then((m) => m.ExamEditor) },
      { path: 'courses', title: 'Courses · Qubit Admin', loadComponent: () => import('./admin/courses').then((m) => m.AdminCourses) },
      { path: 'courses/new', title: 'New course · Qubit Admin', loadComponent: () => import('./admin/course-editor').then((m) => m.CourseEditor) },
      { path: 'courses/:id', title: 'Edit course · Qubit Admin', loadComponent: () => import('./admin/course-editor').then((m) => m.CourseEditor) },
      { path: 'media', title: 'Media library · Qubit Admin', loadComponent: () => import('./admin/media').then((m) => m.MediaPage) },
      { path: 'live', title: 'Live monitor · Qubit Admin', loadComponent: () => import('./admin/live-monitor').then((m) => m.LiveMonitor) },
      { path: 'integrity', title: 'Integrity & appeals · Qubit Admin', loadComponent: () => import('./admin/integrity').then((m) => m.IntegrityPage) },
      { path: 'lookup', title: 'Hall ticket lookup · Qubit Admin', loadComponent: () => import('./admin/lookup').then((m) => m.LookupPage) },
      { path: 'users', title: 'Users · Qubit Admin', canActivate: [superGuard], loadComponent: () => import('./admin/users').then((m) => m.UsersPage) },
      { path: 'system', title: 'System · Qubit Admin', canActivate: [superGuard], loadComponent: () => import('./admin/system').then((m) => m.SystemPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
