import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TripsService } from '../../core/services/trips.service';
import { TripStop } from '../../core/models/trip.model';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './trips-list.component.html',
  styles: `
    .rt-content {
      max-width: 1100px;
    }
    .empty {
      margin: 0;
      font-size: 16px;
    }
    .postcards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .postcard {
      border: 3px solid var(--rt-ink);
      border-radius: 16px;
      background: var(--rt-card);
      box-shadow: 5px 5px 0 var(--rt-ink);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .postcard-header {
      display: flex;
      flex-direction: column;
      padding: 18px 20px;
      background: var(--rt-teal);
      color: var(--rt-cream);
      border-bottom: 3px solid var(--rt-ink);
      text-decoration: none;
    }
    .postcard-header:hover {
      color: var(--rt-cream);
    }
    .greetings {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .trip-name {
      font-family: var(--rt-script);
      font-size: 36px;
      line-height: 1.1;
      text-shadow: 2px 2px 0 var(--rt-cherry);
      overflow-wrap: anywhere;
    }
    .postcard-body {
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }
    .stop-count {
      font-weight: 600;
    }
    .postcard-footer {
      margin-top: auto;
      padding: 12px 20px;
      border-top: 2px dashed var(--rt-ink);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .open {
      margin-left: auto;
    }
  `,
})
export class TripsListComponent implements OnInit {
  private readonly trips = inject(TripsService);

  readonly allTrips = this.trips.trips;
  // Stops per trip for the postcard summary ("3 stops", "A → B → C"). Loaded
  // after the trip list; a trip whose stops fail to load just shows no summary.
  readonly stopsByTrip = signal<Map<string, TripStop[]>>(new Map());

  async ngOnInit(): Promise<void> {
    await this.trips.loadTrips();
    const results = await Promise.allSettled(
      this.allTrips().map(async (trip) => [trip.id, await this.trips.getTripStops(trip.id)] as const),
    );
    const stops = new Map<string, TripStop[]>();
    for (const result of results) {
      if (result.status === 'fulfilled') {
        stops.set(result.value[0], result.value[1]);
      }
    }
    this.stopsByTrip.set(stops);
  }

  routeLabel(stops: TripStop[]): string {
    return stops.map((s) => s.campground.name).join(' → ');
  }

  async onDelete(tripId: string): Promise<void> {
    if (!window.confirm('Delete this trip?')) {
      return;
    }
    await this.trips.deleteTrip(tripId);
  }
}
