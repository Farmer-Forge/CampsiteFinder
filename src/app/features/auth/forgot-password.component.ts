import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './auth.scss',
})
export class ForgotPasswordComponent {
  email = '';
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);
  readonly submitting = signal(false);

  constructor(private readonly supabase: SupabaseService) {}

  // Supabase answers the same way whether or not the email has an account,
  // and so does this page — it must not reveal who is registered. Only a
  // failed request (e.g. the email rate limit) is reported.
  async onSubmit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(this.email, {
      // Must be listed under Supabase Auth → URL Configuration → Redirect URLs.
      redirectTo: `${window.location.origin}/reset-password`,
    });
    this.submitting.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.sent.set(true);
  }
}
