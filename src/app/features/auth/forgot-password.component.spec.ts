import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { SupabaseService } from '../../core/services/supabase.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let resetSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: SupabaseService, useValue: { client: { auth: { resetPasswordForEmail: resetSpy } } } },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
    component = TestBed.createComponent(ForgotPasswordComponent).componentInstance;
  });

  it('requests a reset email that links back to this site\'s reset page', async () => {
    component.email = 'a@b.com';

    await component.onSubmit();

    expect(resetSpy).toHaveBeenCalledWith('a@b.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('confirms without revealing whether the account exists', async () => {
    component.email = 'a@b.com';

    await component.onSubmit();

    expect(component.sent()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('shows the error when the request itself fails (e.g. rate limited)', async () => {
    resetSpy.mockResolvedValue({ data: null, error: { message: 'Too many requests' } });
    component.email = 'a@b.com';

    await component.onSubmit();

    expect(component.sent()).toBe(false);
    expect(component.error()).toBe('Too many requests');
  });
});
