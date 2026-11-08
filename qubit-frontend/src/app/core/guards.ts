import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

export const staffGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
  return auth.isStaff() ? true : router.createUrlTree(['/app']);
};

export const superGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isSuper() ? true : inject(Router).createUrlTree(['/admin']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree([auth.homeRoute()]) : true;
};
