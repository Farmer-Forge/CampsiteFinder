import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinderSnapshot, FinderStateService, FINDER_STATE_STORAGE_KEY } from './finder-state.service';

const SNAPSHOT: FinderSnapshot = {
  location: { lat: 44.31, lng: -68.21 },
  agencies: ['NPS', 'BLM'],
  states: ['ME', 'NH'],
  regions: ['Northeast'],
  parks: ['acad'],
  nearMeEnabled: true,
  radiusMiles: 100,
};

describe('FinderStateService', () => {
  let service: FinderStateService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FinderStateService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('returns null when nothing has been saved', () => {
    expect(service.snapshot()).toBeNull();
  });

  it('returns what was saved', () => {
    service.save(SNAPSHOT);

    expect(service.snapshot()).toEqual(SNAPSHOT);
  });

  it('restores a saved snapshot from sessionStorage in a fresh service instance', () => {
    service.save(SNAPSHOT);

    const fresh = new FinderStateService();

    expect(fresh.snapshot()).toEqual(SNAPSHOT);
  });

  it('accepts a null parks list (meaning all parks)', () => {
    service.save({ ...SNAPSHOT, parks: null });

    expect(new FinderStateService().snapshot()?.parks).toBeNull();
  });

  it('ignores unparseable storage', () => {
    sessionStorage.setItem(FINDER_STATE_STORAGE_KEY, '{not json');

    expect(service.snapshot()).toBeNull();
  });

  it('ignores a stored location that is out of range', () => {
    sessionStorage.setItem(
      FINDER_STATE_STORAGE_KEY,
      JSON.stringify({ ...SNAPSHOT, location: { lat: 123, lng: -68.21 } }),
    );

    expect(service.snapshot()).toBeNull();
  });

  it('ignores a stored snapshot with the wrong shape', () => {
    sessionStorage.setItem(FINDER_STATE_STORAGE_KEY, JSON.stringify({ ...SNAPSHOT, agencies: 'NPS' }));

    expect(service.snapshot()).toBeNull();
  });

  it('keeps working in memory when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(service.snapshot()).toBeNull();
    service.save(SNAPSHOT);
    expect(service.snapshot()).toEqual(SNAPSHOT);
  });
});
