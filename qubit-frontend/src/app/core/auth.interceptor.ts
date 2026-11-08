import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService, SILENT_401 } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const isAuthCall = req.url.startsWith('/api/auth/');
  const authed = token && !isAuthCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthCall && token && !req.context.get(SILENT_401)) {
        auth.expire(router.url);
      }
      return throwError(() => err);
    }),
  );
};
