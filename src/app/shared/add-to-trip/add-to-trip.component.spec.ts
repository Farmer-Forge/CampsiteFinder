import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AddToTripComponent } from './add-to-trip.component';
import { TripsService } from '../../core/services/trips.service';
import { SupabaseService } from '../../core/services/supabase.service';

describe('AddToTripComponent', () => {
  let component: AddToTripComponent;
  let loadTripsSpy: ReturnType<typeof vi.fn>;
  let getTripIdsSpy: ReturnType<typeof vi.fn>;
  let addStopSpy: ReturnType<typeof vi.fn>;
  let createTripSpy: ReturnType<typeof vi.fn>;

  function createComponent(): AddToTripComponent {
    const c = TestBed.createComponent(AddToTripComponent).componentInstance;
    c.campgroundId = 'cg-1';
    return c;
  }

  beforeEach(() => {
    loadTripsSpy = vi.fn().mockResolvedValue(undefined);
    getTripIdsSpy = vi.fn().mockResolvedValue(new Set());
    addStopSpy = vi.fn().mockResolvedValue(undefined);
    createTripSpy = vi.fn().mockResolvedValue('trip-new');

    TestBed.configureTestingModule({
      imports: [AddToTripComponent],
      providers: [
        {
          provide: TripsService,
          useValue: {
            trips: () => [],
            loadTrips: loadTripsSpy,
            getTripIdsForCampground: getTripIdsSpy,
            addStop: addStopSpy,
            createTrip: createTripSpy,
          },
        },
        { provide: SupabaseService, useValue: { isAuthenticated: true } },
      ],
    });

    component = createComponent();
  });

  it('loads trips and the containing-trip set when the panel opens', async () => {
    getTripIdsSpy.mockResolvedValue(new Set(['trip-1']));

    await component.load();

    expect(loadTripsSpy).toHaveBeenCalled();
    expect(getTripIdsSpy).toHaveBeenCalledWith('cg-1');
    expect(component.tripsContaining()).toEqual(new Set(['trip-1']));
  });

  it('sets an error if loading trips fails', async () => {
    getTripIdsSpy.mockRejectedValue(new Error('boom'));

    await component.load();

    expect(component.error()).toBe("Couldn't load trips — try again.");
  });

  it('adds the campground to an existing trip and marks it as containing', async () => {
    const done = vi.fn();
    component.done.subscribe(done);

    await component.onAdd('trip-1');

    expect(addStopSpy).toHaveBeenCalledWith('trip-1', 'cg-1');
    expect(component.tripsContaining()).toEqual(new Set(['trip-1']));
    expect(done).toHaveBeenCalled();
  });

  it('sets an error and keeps the panel open if adding to a trip fails', async () => {
    addStopSpy.mockRejectedValue(new Error('boom'));
    const done = vi.fn();
    component.done.subscribe(done);

    await component.onAdd('trip-1');

    expect(component.error()).toBe("Couldn't add to that trip — try again.");
    expect(done).not.toHaveBeenCalled();
  });

  it('creates a new trip with this campground and clears the draft name', async () => {
    const done = vi.fn();
    component.done.subscribe(done);
    component.newTripName = '  Maine Coast  ';

    await component.onCreateAndAdd();

    expect(createTripSpy).toHaveBeenCalledWith('Maine Coast', ['cg-1']);
    expect(component.newTripName).toBe('');
    expect(done).toHaveBeenCalled();
  });

  it('does not create a trip when the draft name is blank', async () => {
    const done = vi.fn();
    component.done.subscribe(done);
    component.newTripName = '   ';

    await component.onCreateAndAdd();

    expect(createTripSpy).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });

  it('sets an error and keeps the panel open if creating a trip fails', async () => {
    createTripSpy.mockRejectedValue(new Error('boom'));
    const done = vi.fn();
    component.done.subscribe(done);
    component.newTripName = 'Maine Coast';

    await component.onCreateAndAdd();

    expect(component.error()).toBe("Couldn't create that trip — try again.");
    expect(done).not.toHaveBeenCalled();
  });
});
