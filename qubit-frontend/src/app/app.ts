import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { Toaster } from './shared/toaster';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toaster],
  template: `<router-outlet /><app-toaster />`,
})
export class App {
  constructor() {
    inject(AuthService).refreshMe();
  }
}
