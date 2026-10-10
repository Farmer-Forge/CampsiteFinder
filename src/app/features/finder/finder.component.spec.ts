import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinderComponent, SHOW_ALL_RADIUS_M, METERS_PER_MILE } from './finder.component';
import { GeolocationService } from '../../core/services/geolocation.service';
import { CampgroundsService } from '../../core/services/campgrounds.service';
import { FinderSnapshot, FinderStateService } from '../../core/services/finder-state.service';

describe('FinderComponent', () => {
  let fixture: ComponentFixture<FinderComponent>;
  let component: FinderComponent;
  let geolocationSpy: { getCurrentPosition: ReturnType<typeof vi.fn>; checkPermissionState: ReturnType<typeof vi.fn> };
  let campgroundsSpy: { getNearest: ReturnType<typeof vi.fn>; getParkCodes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // FinderStateService mirrors to sessionStorage, which outlives each
    // TestBed's root injector — clear it so saved searches don't leak between tests.
    sessionStorage.clear();
    geolocationSpy = {
      getCurrentPosition: vi.fn(),
      checkPermissionState: vi.fn().mockResolvedValue('unsupported'),
    };
    campgroundsSpy = { getNearest: vi.fn(), getParkCodes: vi.fn().mockResolvedValue([]) };

    TestBed.configureTestingModule({
      imports: [FinderComponent],
      providers: [
        { provide: GeolocationService, useValue: geolocationSpy },
        { provide: CampgroundsService, useValue: campgroundsSpy },
      ],
    });

    fixture = TestBed.createComponent(FinderComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('loads nearest campgrounds using the browser location on init', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([{ id: '1', name: 'A' } as any]);

    await component.ngOnInit();

    expect(component.campgrounds().length).toBe(1);
    expect(component.error()).toBeNull();
  });

  it('shows an error and stops loading when geolocation fails', async () => {
    geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('denied'));

    await component.ngOnInit();

    expect(component.error()).toBe('denied');
    expect(component.loading()).toBe(false);
  });

  it('flags location as blocked when the browser permission is denied', async () => {
    geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('denied'));
    geolocationSpy.checkPermissionState.mockResolvedValue('denied');

    await component.ngOnInit();

    expect(component.locationBlocked()).toBe(true);
  });

  it('does not flag location as blocked when permission is merely undecided', async () => {
    geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('dismissed'));
    geolocationSpy.checkPermissionState.mockResolvedValue('prompt');

    await component.ngOnInit();

    expect(component.locationBlocked()).toBe(false);
  });

  it('retries the browser location lookup on demand', async () => {
    geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('denied'));
    await component.ngOnInit();
    expect(component.error()).toBe('denied');

    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([{ id: '1', name: 'A' } as any]);
    await component.onRetryLocation();

    expect(component.error()).toBeNull();
    expect(component.campgrounds().length).toBe(1);
  });

  it('publishes the resolved coordinates as the search location', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);

    await component.ngOnInit();

    expect(component.searchLocation()).toEqual({ lat: 44.3, lng: -68.2 });
  });

  it('starts with the location-change form hidden', () => {
    expect(component.showLocationForm()).toBe(false);
  });

  it('toggles the location-change form', () => {
    component.onToggleLocationForm();
    expect(component.showLocationForm()).toBe(true);

    component.onToggleLocationForm();
    expect(component.showLocationForm()).toBe(false);
  });

  it('closes the location-change form after a manual submit', async () => {
    campgroundsSpy.getNearest.mockResolvedValue([]);
    component.onToggleLocationForm();
    component.manualLat = 10;
    component.manualLng = 20;

    component.onManualSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.showLocationForm()).toBe(false);
    expect(component.searchLocation()).toEqual({ lat: 10, lng: 20 });
  });

  it('does not check permission state for a manually submitted location', async () => {
    campgroundsSpy.getNearest.mockRejectedValue(new Error('network down'));

    await component.loadNearest({ lat: 10, lng: 20 });

    expect(geolocationSpy.checkPermissionState).not.toHaveBeenCalled();
  });

  it('defaults to all agencies selected', () => {
    expect(component.selectedAgencies).toEqual(component.ALL_AGENCIES);
  });

  it('defaults to near-me off (show all)', () => {
    expect(component.nearMeEnabled).toBe(false);
  });

  it('defaults the near-me radius to 50 miles', () => {
    expect(component.radiusMiles).toBe(50);
  });

  it('loads with the show-all radius by default', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);

    await component.ngOnInit();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('reloads with the selected agencies and the last-used coordinates when the filter changes', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    component.selectedAgencies = ['USFS'];
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, ['USFS'], SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('applies the selected radius in meters when near-me is enabled', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    component.nearMeEnabled = true;
    component.radiusMiles = 100;
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, 100 * METERS_PER_MILE, undefined, undefined,
    );
  });

  it('reverts to the show-all radius when near-me is turned back off', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    component.nearMeEnabled = true;
    component.radiusMiles = 25;
    await component.onFilterChange();
    component.nearMeEnabled = false;
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('does not reload on filter change before any coordinates have been resolved', async () => {
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).not.toHaveBeenCalled();
  });

  it('defaults to all states and all regions selected', () => {
    expect(component.selectedStates).toEqual(component.ALL_STATES);
    expect(component.selectedRegions).toEqual(component.REGION_NAMES);
  });

  it('sends no state filter when all states are selected', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);

    await component.ngOnInit();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('reloads with the selected states when the filter changes', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    component.selectedStates = ['CO'];
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, ['CO'], undefined,
    );
  });

  it('selects the campground the map reports viewDetails for', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    const campground = { id: '1', name: 'A' } as any;
    campgroundsSpy.getNearest.mockResolvedValue([campground]);
    await component.ngOnInit();

    component.onViewDetails('1');

    expect(component.selected()).toBe(campground);
  });

  it('clears the selection when viewDetails reports an id no longer in the results', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([{ id: '1', name: 'A' } as any]);
    await component.ngOnInit();

    component.onViewDetails('missing');

    expect(component.selected()).toBeNull();
  });

  it('loads the known park codes on init and selects them all by default', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);

    await component.ngOnInit();

    expect(component.parkCodes()).toEqual(['acad', 'yell']);
    expect(component.selectedParks).toEqual(['acad', 'yell']);
  });

  it('sends no park filter when all parks are selected', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);

    await component.ngOnInit();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('reloads with the selected parks when the filter changes', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
    await component.ngOnInit();

    component.selectedParks = ['acad'];
    await component.onFilterChange();

    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, ['acad'],
    );
  });

  it('turns an agency off when its chip is toggled', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    await component.onToggleAgency('BLM');

    expect(component.selectedAgencies).toEqual(['NPS', 'USFS', 'USACE', 'FWS']);
    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, ['NPS', 'USFS', 'USACE', 'FWS'], SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('turns an agency back on in its canonical position', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();
    component.selectedAgencies = ['NPS', 'FWS'];

    await component.onToggleAgency('BLM');

    expect(component.selectedAgencies).toEqual(['NPS', 'BLM', 'FWS']);
  });

  it('maps a numeric radius choice onto near-me + radiusMiles', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    await component.onRadiusChange(100);

    expect(component.nearMeEnabled).toBe(true);
    expect(component.radiusMiles).toBe(100);
    expect(component.isRadiusSelected(100)).toBe(true);
    expect(component.isRadiusSelected(null)).toBe(false);
    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, 100 * METERS_PER_MILE, undefined, undefined,
    );
  });

  it('maps the "All" radius choice to near-me off', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();
    await component.onRadiusChange(25);

    await component.onRadiusChange(null);

    expect(component.nearMeEnabled).toBe(false);
    expect(component.isRadiusSelected(null)).toBe(true);
    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
  });

  it('selects every region and recomputes states when the region select-all checkbox is checked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();
    component.selectedRegions = ['West'];

    await component.onToggleAllRegions(true);

    expect(component.selectedRegions).toEqual(component.REGION_NAMES);
    expect(component.selectedStates).toEqual(component.ALL_STATES);
  });

  it('clears every region and its derived states when the region select-all checkbox is unchecked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    await component.onToggleAllRegions(false);

    expect(component.selectedRegions).toEqual([]);
    expect(component.selectedStates).toEqual([]);
  });

  it('selects every state when the state select-all checkbox is checked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();
    component.selectedStates = ['CO'];

    await component.onToggleAllStates(true);

    expect(component.selectedStates).toEqual(component.ALL_STATES);
  });

  it('clears every state when the state select-all checkbox is unchecked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    await component.onToggleAllStates(false);

    expect(component.selectedStates).toEqual([]);
  });

  it('selects every park when the park select-all checkbox is checked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
    await component.ngOnInit();
    component.selectedParks = ['acad'];

    await component.onToggleAllParks(true);

    expect(component.selectedParks).toEqual(['acad', 'yell']);
  });

  it('clears every park when the park select-all checkbox is unchecked', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
    await component.ngOnInit();

    await component.onToggleAllParks(false);

    expect(component.selectedParks).toEqual([]);
  });

  it('recomputes selected states from the selected regions', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    component.selectedRegions = ['West'];
    await component.onRegionFilterChange();

    expect(component.selectedStates).toEqual(component.REGIONS['West']);
    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 44.3, lng: -68.2 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, component.REGIONS['West'], undefined,
    );
  });

  describe('remembering the last search', () => {
    const SAVED: FinderSnapshot = {
      location: { lat: 10, lng: 20 },
      agencies: ['NPS', 'BLM'],
      states: ['ME', 'NH'],
      regions: ['Northeast'],
      parks: ['acad'],
      nearMeEnabled: true,
      radiusMiles: 100,
    };

    it('saves the location and filters after a successful load', async () => {
      geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
      campgroundsSpy.getNearest.mockResolvedValue([]);
      await component.ngOnInit();

      component.selectedAgencies = ['USFS'];
      component.nearMeEnabled = true;
      component.radiusMiles = 25;
      await component.onFilterChange();

      expect(TestBed.inject(FinderStateService).snapshot()).toEqual({
        location: { lat: 44.3, lng: -68.2 },
        agencies: ['USFS'],
        states: component.ALL_STATES,
        regions: component.REGION_NAMES,
        parks: null,
        nearMeEnabled: true,
        radiusMiles: 25,
      });
    });

    it('does not save when the load fails', async () => {
      campgroundsSpy.getNearest.mockRejectedValue(new Error('network down'));

      await component.loadNearest({ lat: 10, lng: 20 });

      expect(TestBed.inject(FinderStateService).snapshot()).toBeNull();
    });

    it('reuses a saved search on init instead of asking the browser for a location', async () => {
      TestBed.inject(FinderStateService).save(SAVED);
      campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
      campgroundsSpy.getNearest.mockResolvedValue([]);

      await component.ngOnInit();

      expect(geolocationSpy.getCurrentPosition).not.toHaveBeenCalled();
      expect(component.searchLocation()).toEqual({ lat: 10, lng: 20 });
      expect(component.selectedAgencies).toEqual(['NPS', 'BLM']);
      expect(component.selectedRegions).toEqual(['Northeast']);
      expect(component.nearMeEnabled).toBe(true);
      expect(component.radiusMiles).toBe(100);
      expect(component.selectedParks).toEqual(['acad']);
      expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
        { lat: 10, lng: 20 }, 50, ['NPS', 'BLM'], 100 * METERS_PER_MILE, ['ME', 'NH'], ['acad'],
      );
    });

    it('keeps the saved park selection when saving again after restoring', async () => {
      TestBed.inject(FinderStateService).save(SAVED);
      campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
      campgroundsSpy.getNearest.mockResolvedValue([]);

      await component.ngOnInit();

      expect(TestBed.inject(FinderStateService).snapshot()?.parks).toEqual(['acad']);
    });

    it('drops saved filter values that are no longer valid options', async () => {
      TestBed.inject(FinderStateService).save({
        ...SAVED,
        agencies: ['BLM', 'XYZ', 'NPS'],
        states: ['ME', 'ZZ'],
        regions: ['Northeast', 'Atlantis'],
        parks: ['acad', 'gone'],
        radiusMiles: 37,
      });
      campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
      campgroundsSpy.getNearest.mockResolvedValue([]);

      await component.ngOnInit();

      expect(component.selectedAgencies).toEqual(['NPS', 'BLM']);
      expect(component.selectedStates).toEqual(['ME']);
      expect(component.selectedRegions).toEqual(['Northeast']);
      expect(component.selectedParks).toEqual(['acad']);
      expect(component.radiusMiles).toBe(50);
    });

    it('uses the default all-parks selection when the saved search had all parks', async () => {
      TestBed.inject(FinderStateService).save({ ...SAVED, parks: null });
      campgroundsSpy.getParkCodes.mockResolvedValue(['acad', 'yell']);
      campgroundsSpy.getNearest.mockResolvedValue([]);

      await component.ngOnInit();

      expect(component.selectedParks).toEqual(['acad', 'yell']);
    });
  });

  describe('device location button', () => {
    async function render(): Promise<HTMLElement> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function buttonTexts(el: HTMLElement): string[] {
      return Array.from(el.querySelectorAll('button')).map((b) => b.textContent!.trim());
    }

    it('is offered next to the results', async () => {
      geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
      campgroundsSpy.getNearest.mockResolvedValue([]);

      const el = await render();

      expect(buttonTexts(el)).toContain('Use my device location');
    });

    it('is still offered in the error state when location is blocked', async () => {
      geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('denied'));
      geolocationSpy.checkPermissionState.mockResolvedValue('denied');

      const el = await render();

      expect(buttonTexts(el)).toContain('Use my device location');
      expect(el.textContent).toContain('Site settings');
    });

    it('keeps the current results when a device lookup fails after a location is set', async () => {
      campgroundsSpy.getNearest.mockResolvedValue([{ id: '1', name: 'A' } as any]);
      await component.loadNearest({ lat: 10, lng: 20 });
      geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('Location access was denied.'));
      geolocationSpy.checkPermissionState.mockResolvedValue('denied');

      await component.onRetryLocation();

      expect(component.error()).toBeNull();
      expect(component.deviceLocationError()).toBe('Location access was denied.');
      expect(component.locationBlocked()).toBe(true);
      expect(component.searchLocation()).toEqual({ lat: 10, lng: 20 });
      expect(component.campgrounds().length).toBe(1);
      expect(campgroundsSpy.getNearest).toHaveBeenCalledTimes(1);
    });

    it('shows the inline failure and blocked guidance under the location controls', async () => {
      geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
      campgroundsSpy.getNearest.mockResolvedValue([]);
      const el = await render();
      geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('Location access was denied.'));
      geolocationSpy.checkPermissionState.mockResolvedValue('denied');

      await component.onRetryLocation();
      fixture.detectChanges();

      const inline = el.querySelector('.device-location-error');
      expect(inline?.textContent).toContain('Location access was denied.');
      expect(inline?.textContent).toContain('Site settings');
    });

    it('clears a previous device-lookup failure once a location loads', async () => {
      campgroundsSpy.getNearest.mockResolvedValue([]);
      await component.loadNearest({ lat: 10, lng: 20 });
      geolocationSpy.getCurrentPosition.mockRejectedValue(new Error('timeout'));
      await component.onRetryLocation();
      expect(component.deviceLocationError()).toBe('timeout');

      await component.loadNearest({ lat: 30, lng: 40 });

      expect(component.deviceLocationError()).toBeNull();
    });
  });

  it('searches from a point picked on the map', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    await component.ngOnInit();

    await component.onMapLocationPick({ lat: 40, lng: -100 });

    expect(component.searchLocation()).toEqual({ lat: 40, lng: -100 });
    expect(campgroundsSpy.getNearest).toHaveBeenLastCalledWith(
      { lat: 40, lng: -100 }, 50, component.ALL_AGENCIES, SHOW_ALL_RADIUS_M, undefined, undefined,
    );
    expect(TestBed.inject(FinderStateService).snapshot()?.location).toEqual({ lat: 40, lng: -100 });
  });

  it('enables right-click location picking on its map', async () => {
    geolocationSpy.getCurrentPosition.mockResolvedValue({ lat: 44.3, lng: -68.2 });
    campgroundsSpy.getNearest.mockResolvedValue([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const map = fixture.debugElement.query((de) => de.name === 'app-campground-map');
    expect(map.componentInstance.allowLocationPick).toBe(true);
  });
});

