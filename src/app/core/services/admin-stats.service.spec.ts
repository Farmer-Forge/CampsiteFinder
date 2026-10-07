import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminStatsService } from './admin-stats.service';
import { SupabaseService } from './supabase.service';

describe('AdminStatsService', () => {
  let service: AdminStatsService;
  let rpcSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc: rpcSpy } } }],
    });
    service = TestBed.inject(AdminStatsService);
  });

  it('loads site-wide favorite and trip counts via get_admin_stats', async () => {
    rpcSpy.mockResolvedValue({
      data: [{ favorites_count: 42, trips_count: 7 }],
      error: null,
    });

    await service.loadStats();

    expect(rpcSpy).toHaveBeenCalledWith('get_admin_stats');
    expect(service.stats()).toEqual({ favoritesCount: 42, tripsCount: 7 });
  });

  it('throws when get_admin_stats errors', async () => {
    rpcSpy.mockResolvedValue({ data: null, error: new Error('not authorized') });

    await expect(service.loadStats()).rejects.toThrow('not authorized');
  });
});
