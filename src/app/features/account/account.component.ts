import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account.component.html',
  styles: `
    .rt-content {
      max-width: 720px;
      gap: 20px;
    }
    .card-action {
      align-self: flex-start;
    }
    .password-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }
    .theme-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .theme-toggle {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      font: inherit;
      font-weight: 600;
      font-size: 15px;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      color: var(--rt-ink);
    }
    .track {
      width: 48px;
      height: 26px;
      box-sizing: border-box;
      padding: 2px;
      border-radius: 999px;
      border: 2px solid var(--rt-ink);
      background: var(--rt-sand);
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
    .track.is-on {
      background: var(--rt-teal);
      justify-content: flex-end;
    }
    .knob {
      width: 18px;
      height: 18px;
      box-sizing: border-box;
      border-radius: 50%;
      background: var(--rt-cream);
      border: 2px solid var(--rt-ink);
    }
    .danger-zone {
      border-color: var(--rt-cherry);
      box-shadow: none;
    }
    .danger-zone .rt-heading {
      color: var(--rt-cherry);
    }
    .confirm-text {
      margin: 0;
    }
    .confirm-actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class AccountComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  displayName = '';
  readonly displayNameNotice = signal<string | null>(null);
  readonly displayNameError = signal<string | null>(null);
  readonly savingDisplayName = signal(false);

  newPassword = '';
  confirmPassword = '';
  readonly passwordNotice = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly savingPassword = signal(false);

  readonly isDarkTheme = signal(false);
  readonly themeError = signal<string | null>(null);

  readonly confirmingDelete = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deletingAccount = signal(false);

  async ngOnInit(): Promise<void> {
    await this.userService.loadProfile();
    const profile = this.userService.profile();
    if (profile) {
      this.displayName = profile.displayName;
      this.isDarkTheme.set(profile.theme === 'dark');
    }
  }

  async onSaveDisplayName(): Promise<void> {
    this.displayNameNotice.set(null);
    this.displayNameError.set(null);
    this.savingDisplayName.set(true);
    try {
      await this.userService.updateDisplayName(this.displayName.trim());
      this.displayNameNotice.set('Display name updated.');
    } catch {
      this.displayNameError.set('Could not update display name. Please try again.');
    } finally {
      this.savingDisplayName.set(false);
    }
  }

  async onSavePassword(): Promise<void> {
    this.passwordNotice.set(null);
    this.passwordError.set(null);
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('Passwords do not match.');
      return;
    }
    this.savingPassword.set(true);
    try {
      await this.userService.updatePassword(this.newPassword);
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordNotice.set('Password updated.');
    } catch (err) {
      this.passwordError.set(err instanceof Error ? err.message : 'Could not update password. Please try again.');
    } finally {
      this.savingPassword.set(false);
    }
  }

  async onThemeToggle(isDark: boolean): Promise<void> {
    this.themeError.set(null);
    const previous = this.isDarkTheme();
    this.isDarkTheme.set(isDark);
    try {
      await this.userService.updateTheme(isDark ? 'dark' : 'light');
    } catch {
      this.isDarkTheme.set(previous);
      this.themeError.set('Could not update theme. Please try again.');
    }
  }

  onDeleteAccount(): void {
    this.confirmingDelete.set(true);
  }

  onCancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  async onConfirmDelete(): Promise<void> {
    this.deleteError.set(null);
    this.deletingAccount.set(true);
    try {
      await this.userService.deleteAccount();
      this.router.navigateByUrl('/');
    } catch {
      this.deleteError.set('Could not delete account. Please try again.');
      this.deletingAccount.set(false);
    }
  }
}
