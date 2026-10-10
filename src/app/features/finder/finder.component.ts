import { Component, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import { CampgroundMapComponent } from './campground-map/campground-map.component';
import { CampgroundTableComponent } from './campground-table/campground-table.component';
import { GeolocationService, Coordinates } from '../../core/services/geolocation.service';
import { CampgroundsService } from '../../core/services/campgrounds.service';
import { FinderSnapshot, FinderStateService } from '../../core/services/finder-state.service';
import { Campground } from '../../core/models/campground.model';

export const METERS_PER_MILE = 1609.34;
// Half of Earth's circumference — larger than any possible distance between
// two points, so passing this as max_distance_m hits nearest_campgrounds's
// "no count cap" branch and returns every matching row, however large the
// dataset grows. This is how "Show all" is implemented, not a real radius.
export const SHOW_ALL_RADIUS_M = 20_038_000;

@Component({
  selector: 'app-finder',
  standalone: true,
  imports: [
    CampgroundMapComponent,
    CampgroundTableComponent,
    NgTemplateOutlet,
    FormsModule,
    MultiSelectModule,
  ],
  templateUrl: './finder.component.html',
  styleUrl: './finder.component.scss',
})
export class FinderComponent implements OnInit {
  readonly campgrounds = signal<Campground[]>([]);
  readonly selected = signal<Campground | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  // True only once the browser permission is known to be explicitly 'denied'
  // — that's the one state a "Try again" button can't do anything about.
  readonly locationBlocked = signal(false);
  // A failed device lookup while a search location is already set: shown
  // inline under the location controls instead of replacing the results
  // with the full error view.
  readonly deviceLocationError = signal<string | null>(null);
  readonly searchLocation = signal<Coordinates | null>(null);
  readonly showLocationForm = signal(false);

  readonly ALL_AGENCIES = ['NPS', 'USFS', 'BLM', 'USACE', 'FWS'];
  readonly RADIUS_OPTIONS = [25, 50, 100, 250];
  // "Miles from me" segmented control: null is "All" (near-me off).
  readonly RADIUS_CHOICES: (number | null)[] = [null, ...this.RADIUS_OPTIONS];
  readonly REGIONS: Record<string, string[]> = {
    Northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
    Midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
    South: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV', 'DC'],
    West: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  };
  readonly ALL_STATES = Object.values(this.REGIONS).flat();
  readonly REGION_NAMES = Object.keys(this.REGIONS);
  selectedAgencies: string[] = [...this.ALL_AGENCIES];
  selectedStates: string[] = [...this.ALL_STATES];
  selectedRegions: string[] = [...this.REGION_NAMES];
  nearMeEnabled = false;
  radiusMiles = 50;

  // Unlike agency/state/region, park codes aren't a fixed enum — they're
  // whatever NPS units are actually present in the data — so this list is
  // fetched once rather than hardcoded, and starts empty until it resolves.
  readonly parkCodes = signal<string[]>([]);
  selectedParks: string[] = [];

  manualLat: number | null = null;
  manualLng: number | null = null;

  constructor(
    private readonly geolocation: GeolocationService,
    private readonly campgroundsService: CampgroundsService,
    private readonly finderState: FinderStateService,
  ) {}

  async ngOnInit(): Promise<void> {
    const saved = this.finderState.snapshot();
    if (!saved) {
      await Promise.all([this.loadNearest(), this.loadParkCodes()]);
      return;
    }
    this.applySnapshot(saved);
    // Sequential, unlike the fresh-start path: the saved park selection can
    // only be resolved once the park list is known — querying first would
    // send (and then re-save) it as "all parks".
    await this.loadParkCodes(saved.parks);
    await this.loadNearest(saved.location);
  }

  // Saved filters may predate a change to the option lists, so keep only
  // values that are still offered (in canonical order).
  private applySnapshot(saved: FinderSnapshot): void {
    this.selectedAgencies = this.ALL_AGENCIES.filter((a) => saved.agencies.includes(a));
    this.selectedStates = this.ALL_STATES.filter((s) => saved.states.includes(s));
    this.selectedRegions = this.REGION_NAMES.filter((r) => saved.regions.includes(r));
    this.nearMeEnabled = saved.nearMeEnabled;
    if (this.RADIUS_OPTIONS.includes(saved.radiusMiles)) {
      this.radiusMiles = saved.radiusMiles;
    }
  }

  // `savedParks` null (or absent) means "all parks", the default.
  private async loadParkCodes(savedParks: string[] | null = null): Promise<void> {
    try {
      const codes = await this.campgroundsService.getParkCodes();
      this.parkCodes.set(codes);
      this.selectedParks = savedParks ? codes.filter((c) => savedParks.includes(c)) : [...codes];
    } catch {
      // Non-critical: the park filter just ends up with nothing to offer.
    }
  }

  async loadNearest(coords?: Coordinates): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.deviceLocationError.set(null);
    if (!coords) {
      this.locationBlocked.set(false);
    }
    let location: Coordinates;
    try {
      location = coords ?? (await this.geolocation.getCurrentPosition());
    } catch (err) {
      await this.handleDeviceLocationFailure(err);
      this.loading.set(false);
      return;
    }
    try {
      this.searchLocation.set(location);
      const maxDistanceMeters = this.nearMeEnabled
        ? this.radiusMiles * METERS_PER_MILE
        : SHOW_ALL_RADIUS_M;
      // Sending the exhaustive state list would exclude any row whose state
      // hasn't been backfilled yet (state is nullable, unlike agency, so an
      // "all selected" state filter isn't a true no-op) — send undefined
      // instead so those rows keep showing up until synced.
      const states =
        this.selectedStates.length === this.ALL_STATES.length ? undefined : this.selectedStates;
      const parks =
        this.selectedParks.length === this.parkCodes().length ? undefined : this.selectedParks;
      const results = await this.campgroundsService.getNearest(
        location,
        50,
        this.selectedAgencies,
        maxDistanceMeters,
        states,
        parks,
      );
      this.campgrounds.set(results);
      this.finderState.save({
        location,
        agencies: [...this.selectedAgencies],
        states: [...this.selectedStates],
        regions: [...this.selectedRegions],
        parks: parks ? [...parks] : null,
        nearMeEnabled: this.nearMeEnabled,
        radiusMiles: this.radiusMiles,
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unable to load nearby campgrounds.');
    } finally {
      this.loading.set(false);
    }
  }

  // Only a failed *browser* lookup implies anything about site permission —
  // a query failing for a known location (e.g. a network error) has nothing
  // to do with geolocation, so that path never gets here.
  private async handleDeviceLocationFailure(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : 'Your location could not be determined.';
    const state = await this.geolocation.checkPermissionState();
    this.locationBlocked.set(state === 'denied');
    if (this.searchLocation()) {
      this.deviceLocationError.set(message);
    } else {
      this.error.set(message);
    }
  }

  onManualSubmit(): void {
    if (this.manualLat != null && this.manualLng != null) {
      this.showLocationForm.set(false);
      this.loadNearest({ lat: this.manualLat, lng: this.manualLng });
    }
  }

  onRetryLocation(): Promise<void> {
    return this.loadNearest();
  }

  onToggleLocationForm(): void {
    this.showLocationForm.update((shown) => !shown);
  }

  onFilterChange(): Promise<void> {
    const location = this.searchLocation();
    return location ? this.loadNearest(location) : Promise.resolve();
  }

  onToggleAgency(agency: string): Promise<void> {
    this.selectedAgencies = this.selectedAgencies.includes(agency)
      ? this.selectedAgencies.filter((a) => a !== agency)
      : this.ALL_AGENCIES.filter((a) => a === agency || this.selectedAgencies.includes(a));
    return this.onFilterChange();
  }

  isRadiusSelected(choice: number | null): boolean {
    return choice === null ? !this.nearMeEnabled : this.nearMeEnabled && this.radiusMiles === choice;
  }

  onRadiusChange(choice: number | null): Promise<void> {
    this.nearMeEnabled = choice !== null;
    if (choice !== null) {
      this.radiusMiles = choice;
    }
    return this.onFilterChange();
  }

  onRegionFilterChange(): Promise<void> {
    this.selectedStates = this.selectedRegions.flatMap((region) => this.REGIONS[region]);
    return this.onFilterChange();
  }

  // PrimeNG's multiselect header "select/deselect all" checkbox only reflects
  // and drives selection state on its own when `selectAll` is left unbound.
  // Binding it (done here so the checkbox's checked state actually matches
  // reality — see conversation) switches it to "controlled" mode: the
  // component stops updating the model itself and only emits this event, so
  // each filter needs its own handler to apply the all-or-nothing toggle.
  onToggleAllRegions(checked: boolean): Promise<void> {
    this.selectedRegions = checked ? [...this.REGION_NAMES] : [];
    return this.onRegionFilterChange();
  }

  onToggleAllStates(checked: boolean): Promise<void> {
    this.selectedStates = checked ? [...this.ALL_STATES] : [];
    return this.onFilterChange();
  }

  onToggleAllParks(checked: boolean): Promise<void> {
    this.selectedParks = checked ? [...this.parkCodes()] : [];
    return this.onFilterChange();
  }

  onSelectionChange(campground: Campground | null): void {
    this.selected.set(campground);
  }

  onViewDetails(campgroundId: string): void {
    const campground = this.campgrounds().find((c) => c.id === campgroundId) ?? null;
    this.selected.set(campground);
  }
}
