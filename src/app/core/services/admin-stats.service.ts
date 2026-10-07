import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AdminStats {
  favoritesCount: number;
  tripsCount: number;
}

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly supabase = inject(SupabaseService);
  readonly stats = signal<AdminStats | null>(null);

  async loadStats(): Promise<void> {
    const { data, error } = await this.supabase.client.rpc('get_admin_stats');
    if (error) throw error;
    const row = (data ?? [])[0];
    this.stats.set({
      favoritesCount: row?.favorites_count ?? 0,
      tripsCount: row?.trips_count ?? 0,
    });
  }
}
