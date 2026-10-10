import { Injectable } from '@angular/core';
import { Coordinates } from './geolocation.service';

export const FINDER_STATE_STORAGE_KEY = 'campsite-finder.finder';

// The last search that actually loaded: where it was measured from and the
// filters it used. `parks: null` means "all parks" — the park list is fetched
// at runtime, so "all" can't be stored as a fixed list.
export interface FinderSnapshot {
  location: Coordinates;
  agencies: string[];
  states: string[];
  regions: string[];
  parks: string[] | null;
  nearMeEnabled: boolean;
  radiusMiles: number;
}

// FinderComponent is destroyed whenever the user navigates away, taking its
// fields with it — this root-provided service outlives it, so coming back to
// Finder can pick up where the user left off instead of asking the browser
// for a location again. It's mirrored to sessionStorage so a refresh keeps it
// too. Storage can be unavailable (private windows, blocked site data) and
// can hold anything (an older shape, a hand edit), so every read is
// validated and every storage call degrades to in-memory only.
@Injectable({ providedIn: 'root' })
export class FinderStateService {
  private current: FinderSnapshot | null = null;

  snapshot(): FinderSnapshot | null {
    if (!this.current) {
      this.current = this.readStorage();
    }
    return this.current;
  }

  save(snapshot: FinderSnapshot): void {
    this.current = snapshot;
    try {
      sessionStorage.setItem(FINDER_STATE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // In-memory state still covers navigation within this session.
    }
  }

  private readStorage(): FinderSnapshot | null {
    try {
      const raw = sessionStorage.getItem(FINDER_STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isFinderSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isFinderSnapshot(value: unknown): value is FinderSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const location = s['location'] as Record<string, unknown> | null | undefined;
  const lat = location?.['lat'];
  const lng = location?.['lng'];
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    isStringArray(s['agencies']) &&
    isStringArray(s['states']) &&
    isStringArray(s['regions']) &&
    (s['parks'] === null || isStringArray(s['parks'])) &&
    typeof s['nearMeEnabled'] === 'boolean' &&
    typeof s['radiusMiles'] === 'number'
  );
}
