import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly supabase = inject(SupabaseService);
  readonly userService = inject(UserService);

  constructor() {
    effect(() => {
      if (this.supabase.session()) {
        this.userService.loadProfile();
      }
    });
  }

  onSignOut(): void {
    this.supabase.client.auth.signOut();
  }
}
