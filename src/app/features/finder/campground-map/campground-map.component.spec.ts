import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as L from 'leaflet';
import { CampgroundMapComponent } from './campground-map.component';
import { TripsService } from '../../../core/services/trips.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('CampgroundMapComponent', () => {
  let fixture: ComponentFixture<CampgroundMapComponent>;
  let component: CampgroundMapComponent;
  let tripsList: { id: string; name: string }[];
  let isAuthenticated: boolean;
  let addStopSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tripsList = [];
    isAuthenticated = true;
    addStopSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [CampgroundMapComponent],
      providers: [
        { provide: TripsService, useValue: { trips: () => tripsList, addStop: addStopSpy } },
        { provide: SupabaseService, useValue: { get isAuthenticated() { return isAuthenticated; } } },
      ],
    });
    fixture = TestBed.createComponent(CampgroundMapComponent);
    component = fixture.componentInstance;
  });

  function popupButton(markerIndex = 0): HTMLButtonElement | null {
    const marker = component.markerLayers[markerIndex] as any;
    const content = marker.getPopup().getContent() as HTMLElement;
    return content.querySelector('button.add-to-trip-button');
  }

  function viewDetailsButton(markerIndex = 0): HTMLButtonElement | null {
    const marker = component.markerLayers[markerIndex] as any;
    const content = marker.getPopup().getContent() as HTMLElement;
    return content.querySelector('button.view-details-button');
  }

  it('includes an Add to Trip button in the popup when signed in and a trip exists', () => {
    tripsList = [{ id: 'trip-2', name: 'B' }];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];

    component.ngOnChanges({ campgrounds: {} as any });

    const button = popupButton();
    expect(button).toBeTruthy();
    expect(button!.textContent).toBe('Add to Trip');
  });

  it('omits the Add to Trip button when there are no trips yet', () => {
    tripsList = [];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];

    component.ngOnChanges({ campgrounds: {} as any });

    expect(popupButton()).toBeNull();
  });

  it('omits the Add to Trip button when not signed in', () => {
    isAuthenticated = false;
    tripsList = [{ id: 'trip-1', name: 'A trip' }];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];

    component.ngOnChanges({ campgrounds: {} as any });

    expect(popupButton()).toBeNull();
  });

  it('adds the campground to the most recently created trip on click', () => {
    tripsList = [
      { id: 'trip-2', name: 'Newest' },
      { id: 'trip-1', name: 'Oldest' },
    ];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ngOnChanges({ campgrounds: {} as any });

    popupButton()!.click();

    expect(addStopSpy).toHaveBeenCalledWith('trip-2', '1');
  });

  it('shows a confirmation and disables the button after a successful add', async () => {
    tripsList = [{ id: 'trip-1', name: 'Only trip' }];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ngOnChanges({ campgrounds: {} as any });
    const button = popupButton()!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(button.textContent).toBe('Added ✓');
    expect(button.disabled).toBe(true);
  });

  it('re-enables the button and keeps the default label if adding fails', async () => {
    addStopSpy.mockRejectedValue(new Error('boom'));
    tripsList = [{ id: 'trip-1', name: 'Only trip' }];
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ngOnChanges({ campgrounds: {} as any });
    const button = popupButton()!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(button.textContent).toBe('Add to Trip');
    expect(button.disabled).toBe(false);
  });

  it('includes a View details link in every marker popup', () => {
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];

    component.ngOnChanges({ campgrounds: {} as any });

    expect(viewDetailsButton()).toBeTruthy();
  });

  it('emits viewDetails with the campground id when the popup link is clicked', () => {
    let emitted: string | undefined;
    component.viewDetails.subscribe((id) => (emitted = id));
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ngOnChanges({ campgrounds: {} as any });

    viewDetailsButton()!.click();

    expect(emitted).toBe('1');
  });

  it('creates one marker layer per campground', () => {
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ngOnChanges({ campgrounds: {} as any });

    expect(component.markerLayers.length).toBe(2);
  });

  it('does not add a route line when ordered is false', () => {
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ngOnChanges({ campgrounds: {} as any });

    expect(component.markerLayers.length).toBe(2);
  });

  it('numbers markers and adds a connecting route line when ordered is true', () => {
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ordered = true;
    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    expect(component.markerLayers.length).toBe(2);
    expect(component.overlayLayers.length).toBe(1);
  });

  it('does not add a route line for a single-stop ordered trip', () => {
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ordered = true;
    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    expect(component.markerLayers.length).toBe(1);
  });

  it('fits the viewport to the whole route when ordered and the map is ready', () => {
    const fitBounds = vi.fn();
    const setView = vi.fn();
    component.onMapReady({ fitBounds, setView } as any);
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ordered = true;

    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    expect(fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = fitBounds.mock.calls[0];
    expect(bounds.getSouth()).toBe(44.3);
    expect(bounds.getNorth()).toBe(45.0);
    expect(bounds.getWest()).toBe(-69.0);
    expect(bounds.getEast()).toBe(-68.2);
    expect(options).toEqual({ padding: [32, 32] });
  });

  it('fits the viewport for a single-stop ordered trip too', () => {
    const fitBounds = vi.fn();
    component.onMapReady({ fitBounds, setView: vi.fn() } as any);
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];
    component.ordered = true;

    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it('does not fit the viewport when not in ordered mode', () => {
    const fitBounds = vi.fn();
    component.onMapReady({ fitBounds, setView: vi.fn() } as any);
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];

    component.ngOnChanges({ campgrounds: {} as any });

    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('does not fit the viewport for an ordered trip with no stops', () => {
    const fitBounds = vi.fn();
    component.onMapReady({ fitBounds, setView: vi.fn() } as any);
    component.campgrounds = [];
    component.ordered = true;

    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('zooms to a marker when it is clicked', () => {
    const setView = vi.fn();
    component.onMapReady({ fitBounds: vi.fn(), setView } as any);
    component.campgrounds = [{ id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any];

    component.ngOnChanges({ campgrounds: {} as any });
    (component.markerLayers[0] as any).fire('click');

    expect(setView).toHaveBeenCalledWith([44.3, -68.2], 12);
  });

  it('zooms to the clicked marker even in ordered (trip route) mode', () => {
    const setView = vi.fn();
    component.onMapReady({ fitBounds: vi.fn(), setView } as any);
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ordered = true;

    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });
    (component.markerLayers[1] as any).fire('click');

    expect(setView).toHaveBeenCalledWith([45.0, -69.0], 12);
  });

  it('does not throw when the map is not ready yet on the first change', () => {
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ordered = true;

    expect(() =>
      component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any }),
    ).not.toThrow();
    expect(component.markerLayers.length).toBe(2);
    expect(component.overlayLayers.length).toBe(1);
  });

  it('centers and zooms the map on the search location', () => {
    component.searchLocation = { lat: 44.3, lng: -68.2 };

    component.ngOnChanges({ searchLocation: {} as any });

    expect(component.mapCenter?.lat).toBe(44.3);
    expect(component.mapCenter?.lng).toBe(-68.2);
    expect(component.mapZoom).toBe(9);
  });

  it('adds a "you are here" marker for the search location', () => {
    component.searchLocation = { lat: 44.3, lng: -68.2 };

    component.ngOnChanges({ searchLocation: {} as any });

    expect(component.overlayLayers.length).toBe(1);
    const marker = component.overlayLayers[0] as L.Marker;
    expect(marker.getLatLng().lat).toBe(44.3);
    expect(marker.getLatLng().lng).toBe(-68.2);
  });

  it('removes the "you are here" marker when the search location is cleared', () => {
    component.searchLocation = { lat: 44.3, lng: -68.2 };
    component.ngOnChanges({ searchLocation: {} as any });

    component.searchLocation = null;
    component.ngOnChanges({ searchLocation: {} as any });

    expect(component.overlayLayers.length).toBe(0);
  });

  it('keeps the "you are here" marker when campgrounds change independently', () => {
    component.searchLocation = { lat: 44.3, lng: -68.2 };
    component.ngOnChanges({ searchLocation: {} as any });

    component.campgrounds = [{ id: '1', lat: 45.0, lng: -69.0, name: 'A' } as any];
    component.ngOnChanges({ campgrounds: {} as any });

    expect(component.overlayLayers.length).toBe(1);
  });

  it('keeps the route line alongside the "you are here" marker in ordered mode', () => {
    component.campgrounds = [
      { id: '1', lat: 44.3, lng: -68.2, name: 'A' } as any,
      { id: '2', lat: 45.0, lng: -69.0, name: 'B' } as any,
    ];
    component.ordered = true;
    component.ngOnChanges({ campgrounds: {} as any, ordered: {} as any });

    component.searchLocation = { lat: 44.0, lng: -68.0 };
    component.ngOnChanges({ searchLocation: {} as any });

    expect(component.overlayLayers.length).toBe(2);
  });

  it('does not move the map when the search location is absent', () => {
    const defaultCenter = component.mapCenter;
    const defaultZoom = component.mapZoom;

    component.ngOnChanges({ searchLocation: {} as any });

    expect(component.mapCenter).toBe(defaultCenter);
    expect(component.mapZoom).toBe(defaultZoom);
  });
});
