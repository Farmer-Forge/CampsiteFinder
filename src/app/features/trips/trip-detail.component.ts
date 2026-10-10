import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampgroundMapComponent } from '../finder/campground-map/campground-map.component';
import { CampgroundDetailPanelComponent } from '../finder/campground-table/campground-detail-panel/campground-detail-panel.component';
import { TripsService } from '../../core/services/trips.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { CampgroundsService } from '../../core/services/campgrounds.service';
import { Trip, TripStop } from '../../core/models/trip.model';
import { Campground } from '../../core/models/campground.model';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, CampgroundMapComponent, CampgroundDetailPanelComponent],
  templateUrl: './trip-detail.component.html',
  styles: `
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .back-link {
      align-self: flex-start;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--rt-teal);
      text-decoration: none;
    }
    .trip-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .rename-row {
      display: flex;
      gap: 8px;
    }
    .rename-row .rt-input {
      flex: 1;
      font-size: 18px;
      padding: 8px 14px;
    }
    .meta-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .meta {
      font-size: 14px;
      font-weight: 600;
      margin-right: auto;
    }
    .stop-card {
      flex: none;
      border: 2px solid var(--rt-ink);
      border-radius: 14px;
      background: var(--rt-card);
      box-shadow: 3px 3px 0 var(--rt-ink);
    }
    .stop-card.is-open {
      background: var(--rt-cream);
    }
    .card-main {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 12px 14px;
      cursor: pointer;
    }
    .stop-badge {
      width: 58px;
      height: 58px;
      flex: none;
      box-sizing: border-box;
      border-radius: 50%;
      background: var(--rt-cherry);
      color: var(--rt-cream);
      border: 2px solid var(--rt-ink);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1;
      gap: 2px;
    }
    .badge-top {
      font-family: var(--rt-display);
      font-size: 17px;
    }
    .badge-sub {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }
    .card-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .campground-name-link {
      font-weight: 700;
      font-size: 17px;
      line-height: 1.3;
    }
    .tags {
      display: flex;
      gap: 6px;
    }
    .reorder {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .reorder button {
      width: 30px;
      height: 24px;
      padding: 0;
      border: 2px solid var(--rt-ink);
      border-radius: 6px;
      background: var(--rt-cream);
      color: var(--rt-ink);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .reorder button:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .detail {
      padding: 2px 14px 16px 86px;
    }
    .add-stop {
      display: flex;
      gap: 8px;
      padding-top: 14px;
      border-top: 2px dashed var(--rt-ink);
    }
    .add-stop .rt-input {
      flex: 1;
    }
    @media (max-width: 900px) {
      :host {
        flex: none;
      }
      .detail {
        padding-left: 14px;
      }
    }
  `,
})
export class TripDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);
  private readonly favorites = inject(FavoritesService);
  private readonly campgroundsService = inject(CampgroundsService);

  private tripId = '';

  readonly trip = signal<Trip | null>(null);
  readonly stops = signal<TripStop[]>([]);
  readonly notFound = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingName = signal(false);
  readonly favoriteCampgrounds = signal<Campground[]>([]);

  readonly stopCampgrounds = computed(() => this.stops().map((s) => s.campground));
  readonly availableToAdd = computed(() => {
    const inTrip = new Set(this.stops().map((s) => s.campground.id));
    return this.favoriteCampgrounds().filter((c) => !inTrip.has(c.id));
  });

  nameDraft = '';
  addStopCampgroundId = '';
  expandedStopId: string | null = null;

  toggleExpanded(stopId: string): void {
    this.expandedStopId = this.expandedStopId === stopId ? null : stopId;
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }
    this.tripId = id;

    try {
      const [trip, stops] = await Promise.all([
        this.tripsService.getTrip(id),
        this.tripsService.getTripStops(id),
      ]);
      if (!trip) {
        this.notFound.set(true);
        return;
      }
      this.trip.set(trip);
      this.stops.set(stops);
    } catch {
      this.notFound.set(true);
      return;
    }

    try {
      await this.favorites.loadFavoriteIds();
      const favIds = Array.from(this.favorites.favoriteIds());
      this.favoriteCampgrounds.set(favIds.length > 0 ? await this.campgroundsService.getByIds(favIds) : []);
    } catch {
      this.favoriteCampgrounds.set([]);
    }
  }

  startRename(): void {
    this.nameDraft = this.trip()?.name ?? '';
    this.editingName.set(true);
  }

  async saveRename(): Promise<void> {
    const name = this.nameDraft.trim();
    if (!name) return;
    this.error.set(null);
    try {
      await this.tripsService.renameTrip(this.tripId, name);
    } catch {
      this.error.set("Couldn't rename this trip — try again.");
      return;
    }
    this.trip.update((t) => (t ? { ...t, name } : t));
    this.editingName.set(false);
  }

  async onDeleteTrip(): Promise<void> {
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    this.error.set(null);
    try {
      await this.tripsService.deleteTrip(this.tripId);
    } catch {
      this.error.set("Couldn't delete this trip — try again.");
      return;
    }
    this.router.navigateByUrl('/trips');
  }

  async onAddStop(): Promise<void> {
    if (!this.addStopCampgroundId) return;
    this.error.set(null);
    try {
      await this.tripsService.addStop(this.tripId, this.addStopCampgroundId);
      this.addStopCampgroundId = '';
      this.stops.set(await this.tripsService.getTripStops(this.tripId));
    } catch {
      this.error.set("Couldn't add that stop — try again.");
    }
  }

  async onRemoveStop(stopId: string): Promise<void> {
    this.error.set(null);
    try {
      await this.tripsService.removeStop(this.tripId, stopId);
    } catch {
      this.error.set("Couldn't remove that stop — try again.");
      return;
    }
    this.stops.update((stops) => stops.filter((s) => s.stopId !== stopId));
  }

  async moveStop(index: number, delta: -1 | 1): Promise<void> {
    const target = index + delta;
    const current = this.stops();
    if (target < 0 || target >= current.length) return;
    const reordered = [...current];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.stops.set(reordered);
    this.error.set(null);
    try {
      await this.tripsService.reorderStops(
        this.tripId,
        reordered.map((s) => s.stopId),
      );
    } catch {
      this.error.set("Couldn't reorder stops — try again.");
      // The on-screen order no longer matches the database (and reorderStops
      // may have persisted some positions before failing). Re-read the stops
      // so what's shown is what's stored; if that read fails too, leave the
      // error message up.
      try {
        this.stops.set(await this.tripsService.getTripStops(this.tripId));
      } catch {
        /* keep the reorder error message */
      }
    }
  }
}
