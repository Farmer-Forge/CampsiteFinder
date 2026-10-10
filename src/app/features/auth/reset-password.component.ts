import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { UserService } from '../../core/services/user.service';

type ResetState = 'checking' | 'ready' | 'invalid' | 'suspended';

// Landing page for the emailed reset link. supabase-js reads the one-time
// token from the URL while the client initializes and signs the user in with
// a recovery session; getSession() waits for that, so no session here means
// the link was expired, already used, or the page was opened directly.
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './auth.scss',
})
export class ResetPasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  readonly state = signal<ResetState>('checking');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userService: UserService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      this.state.set('invalid');
      return;
    }
    // Suspension is only enforced at sign-in, and a recovery session is a
    // real sign-in — so repeat LoginComponent's check rather than let a
    // reset link become a way around it.
    const { data: userRow, error } = await this.supabase.client
      .from('users')
      .select('suspended')
      .eq('id', userId)
      .single();
    if (error || userRow.suspended) {
      await this.supabase.client.auth.signOut();
      this.state.set('suspended');
      return;
    }
    this.state.set('ready');
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.submitting.set(true);
    try {
      await this.userService.updatePassword(this.newPassword);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not update password. Please try again.');
      this.submitting.set(false);
      return;
    }
    // Sign out and back in through the normal page, so the new password is
    // proven to work and the sign-in checks run.
    await this.supabase.client.auth.signOut();
    this.router.navigateByUrl('/login?reset=done');
  }
}
