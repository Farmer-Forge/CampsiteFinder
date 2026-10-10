import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  // Set by ResetPasswordComponent after a successful reset.
  readonly notice: string | null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    route: ActivatedRoute,
  ) {
    this.notice =
      route.snapshot.queryParamMap.get('reset') === 'done'
        ? 'Password updated. Sign in with your new password.'
        : null;
  }

  async onSubmit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });
    if (error) {
      this.submitting.set(false);
      this.error.set(error.message);
      return;
    }

    const { data: userRow, error: suspendedError } = await this.supabase.client
      .from('users')
      .select('suspended')
      .eq('id', data.user!.id)
      .single();
    this.submitting.set(false);
    if (suspendedError) {
      await this.supabase.client.auth.signOut();
      this.error.set(suspendedError.message);
      return;
    }
    if (userRow.suspended) {
      await this.supabase.client.auth.signOut();
      this.error.set('This account has been suspended.');
      return;
    }
    this.router.navigateByUrl('/');
  }
}
