import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { UserService } from '../../core/services/user.service';

function usersQuery(result: { data?: any; error?: any }) {
  const builder: any = {};
  ['select', 'eq'].forEach((m) => (builder[m] = vi.fn().mockReturnValue(builder)));
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let getSessionSpy: ReturnType<typeof vi.fn>;
  let signOutSpy: ReturnType<typeof vi.fn>;
  let fromSpy: ReturnType<typeof vi.fn>;
  let updatePasswordSpy: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const recoverySession = { data: { session: { user: { id: 'user-1' } } } };

  beforeEach(() => {
    getSessionSpy = vi.fn().mockResolvedValue(recoverySession);
    signOutSpy = vi.fn().mockResolvedValue({ error: null });
    fromSpy = vi.fn().mockReturnValue(usersQuery({ data: { suspended: false }, error: null }));
    updatePasswordSpy = vi.fn().mockResolvedValue(undefined);
    navigateSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        {
          provide: SupabaseService,
          useValue: { client: { auth: { getSession: getSessionSpy, signOut: signOutSpy }, from: fromSpy } },
        },
        { provide: UserService, useValue: { updatePassword: updatePasswordSpy } },
        { provide: Router, useValue: { navigateByUrl: navigateSpy } },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
    component = TestBed.createComponent(ResetPasswordComponent).componentInstance;
  });

  it('shows the new-password form when the reset link signed the user in', async () => {
    await component.ngOnInit();

    expect(component.state()).toBe('ready');
  });

  it('reports an invalid or expired link when there is no session', async () => {
    getSessionSpy.mockResolvedValue({ data: { session: null } });

    await component.ngOnInit();

    expect(component.state()).toBe('invalid');
  });

  it('signs a suspended user straight back out instead of letting them reset', async () => {
    fromSpy.mockReturnValue(usersQuery({ data: { suspended: true }, error: null }));

    await component.ngOnInit();

    expect(signOutSpy).toHaveBeenCalled();
    expect(component.state()).toBe('suspended');
  });

  it('rejects mismatched passwords without calling Supabase', async () => {
    await component.ngOnInit();
    component.newPassword = 'abc123';
    component.confirmPassword = 'abc124';

    await component.onSubmit();

    expect(component.error()).toBe('Passwords do not match.');
    expect(updatePasswordSpy).not.toHaveBeenCalled();
  });

  it('sets the password, signs out and sends the user to sign in', async () => {
    await component.ngOnInit();
    component.newPassword = 'newpass1';
    component.confirmPassword = 'newpass1';

    await component.onSubmit();

    expect(updatePasswordSpy).toHaveBeenCalledWith('newpass1');
    expect(signOutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login?reset=done');
  });

  it('shows the Supabase error and stays put when the update fails', async () => {
    updatePasswordSpy.mockRejectedValue(new Error('Password should be at least 6 characters.'));
    await component.ngOnInit();
    component.newPassword = 'abc';
    component.confirmPassword = 'abc';

    await component.onSubmit();

    expect(component.error()).toBe('Password should be at least 6 characters.');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });
});
