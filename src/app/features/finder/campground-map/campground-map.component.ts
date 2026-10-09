import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { Campground } from '../../../core/models/campground.model';
import { Coordinates } from '../../../core/services/geolocation.service';
import { TripsService } from '../../../core/services/trips.service';
import { SupabaseService } from '../../../core/services/supabase.service';

// Roughly a 100-mile view at mid-latitudes — a "here's the region" zoom
// level, not a street-level one.
const SEARCH_LOCATION_ZOOM = 9;

// Leaflet's Icon.Default always prepends an auto-detected `imagePath`
// directory to its icon filenames — it reads the computed background-image
// of a `.leaflet-default-icon-path` element (set via leaflet.css) and uses
// that directory. Angular's build hashes the CSS-referenced marker-icon.png
// into /media/, but the shadow image (only referenced from JS, not CSS)
// never gets copied there, so the guessed URL 404s. Setting `imagePath`
// explicitly (matching the `leaflet/dist/images` assets rule in
// angular.json, which serves these at the site root) bypasses that
// detection entirely.
L.Icon.Default.imagePath = '';
L.Icon.Default.mergeOptions({
  iconUrl: 'marker-icon.png',
  iconRetinaUrl: 'marker-icon-2x.png',
  shadowUrl: 'marker-shadow.png',
});

@Component({
  selector: 'app-campground-map',
  standalone: true,
  imports: [LeafletModule, LeafletMarkerClusterModule],
  template: `
    <div
      class="campground-map"
      leaflet
      [leafletOptions]="mapOptions"
      [leafletLayers]="overlayLayers"
      [leafletCenter]="mapCenter"
      [leafletZoom]="mapZoom"
      [leafletMarkerCluster]="markerLayers"
      [leafletMarkerClusterOptions]="markerClusterOptions"
      (leafletMapReady)="onMapReady($event)"
    ></div>
  `,
  styleUrl: './campground-map.component.scss',
})
export class CampgroundMapComponent implements OnChanges {
  @Input({ required: true }) campgrounds: Campground[] = [];
  @Input() selectedId: string | null = null;
  @Input() ordered = false;
  @Input() searchLocation: Coordinates | null = null;
  @Output() viewDetails = new EventEmitter<string>();

  private readonly tripsService = inject(TripsService);
  private readonly supabase = inject(SupabaseService);

  private map: L.Map | undefined;

  readonly mapOptions: L.MapOptions = {
    layers: [
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }),
    ],
    zoom: 6,
    center: L.latLng(39.8283, -98.5795),
  };

  markerLayers: L.Layer[] = [];
  // MarkerClusterGroup.addLayers (which the leafletMarkerCluster directive
  // uses) expects only markers — a polyline has no getLatLng() and isn't a
  // marker to cluster, so non-campground content (the trip-route line, the
  // "you are here" pin) goes through plain leafletLayers instead, in the
  // separate overlayLayers array above, composed from the two pieces below.
  overlayLayers: L.Layer[] = [];
  private routePolyline: L.Polyline | null = null;
  private locationMarker: L.Marker | null = null;
  readonly markerClusterOptions: L.MarkerClusterGroupOptions = {};

  mapCenter: L.LatLng = this.mapOptions.center as L.LatLng;
  mapZoom: number = this.mapOptions.zoom as number;

  onMapReady(map: L.Map): void {
    this.map = map;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campgrounds'] || changes['ordered']) {
      const markers = this.campgrounds.map((c, index) =>
        L.marker([c.lat, c.lng], this.ordered ? { icon: this.numberedIcon(index + 1) } : {})
          .bindPopup(this.buildPopupContent(c))
          .on('click', () => this.map?.setView([c.lat, c.lng], 12)),
      );
      this.markerLayers = markers;
      this.routePolyline =
        this.ordered && this.campgrounds.length > 1
          ? L.polyline(this.campgrounds.map((c) => [c.lat, c.lng] as L.LatLngTuple))
          : null;
      this.rebuildOverlayLayers();
      // In ordered (trip route) mode nothing else ever moves the viewport —
      // `selectedId` is always null there — so without this the map sits on
      // its constructional default (the middle of the continental US) while
      // the route renders off-screen. `this.map` may not exist yet on the
      // first ngOnChanges (leafletMapReady fires later); skipping the fit in
      // that case matches how the selectedId branch below guards the same
      // timing gap, and the next campgrounds change will fit it.
      if (this.ordered && this.campgrounds.length > 0 && this.map) {
        this.map.fitBounds(
          L.latLngBounds(this.campgrounds.map((c) => [c.lat, c.lng] as L.LatLngTuple)),
          { padding: [32, 32] },
        );
      }
    }
    if (changes['selectedId'] && this.selectedId && this.map) {
      const selected = this.campgrounds.find((c) => c.id === this.selectedId);
      if (selected) {
        this.map.setView([selected.lat, selected.lng], 12);
      }
    }
    if (changes['searchLocation']) {
      if (this.searchLocation) {
        this.mapCenter = L.latLng(this.searchLocation.lat, this.searchLocation.lng);
        this.mapZoom = SEARCH_LOCATION_ZOOM;
        this.locationMarker = L.marker([this.searchLocation.lat, this.searchLocation.lng], {
          icon: this.currentLocationIcon(),
          zIndexOffset: -1000,
        }).bindTooltip('Your search location');
      } else {
        this.locationMarker = null;
      }
      this.rebuildOverlayLayers();
    }
  }

  private rebuildOverlayLayers(): void {
    const layers: (L.Layer | null)[] = [this.routePolyline, this.locationMarker];
    this.overlayLayers = layers.filter((layer): layer is L.Layer => layer !== null);
  }

  // A plain DOM popup, not the AddToTripComponent used elsewhere — Leaflet
  // popups aren't part of Angular's view tree, so projecting a real Angular
  // component in here would require manually managing its lifecycle
  // (createComponent/destroy) on every marker rebuild. This trades the
  // trip-picker UI for a one-click add to the most recently created trip.
  private buildPopupContent(campground: Campground): HTMLElement {
    const container = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = campground.name;
    container.appendChild(name);

    const viewDetailsButton = document.createElement('button');
    viewDetailsButton.className = 'view-details-button';
    viewDetailsButton.textContent = 'View details ▸';
    viewDetailsButton.addEventListener('click', () => {
      this.map?.closePopup();
      this.viewDetails.emit(campground.id);
    });
    container.appendChild(viewDetailsButton);

    const trips = this.tripsService.trips();
    if (this.supabase.isAuthenticated && trips.length > 0) {
      const mostRecentTrip = trips[0];
      const button = document.createElement('button');
      button.className = 'add-to-trip-button';
      button.textContent = 'Add to Trip';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await this.tripsService.addStop(mostRecentTrip.id, campground.id);
          button.textContent = 'Added ✓';
        } catch {
          button.textContent = 'Add to Trip';
          button.disabled = false;
        }
      });
      container.appendChild(button);
    }
    return container;
  }

  private numberedIcon(n: number): L.DivIcon {
    return L.divIcon({
      className: 'trip-stop-marker',
      html: `<span>${n}</span>`,
      iconSize: [28, 28],
    });
  }

  private currentLocationIcon(): L.DivIcon {
    return L.divIcon({
      className: 'current-location-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }
}
