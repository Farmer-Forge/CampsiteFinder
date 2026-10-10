import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TripsService } from '../../core/services/trips.service';

// Inline "Add to trip" panel shown under a campground card. The card owns
// the open/closed state (one panel open at a time); this panel loads on
// creation and emits `done` once the campground has been added somewhere.
@Component({
  selector: 'app-add-to-trip',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="add-to-trip-panel">
      <div class="rt-label">ADD TO TRIP</div>
      @if (trips.trips().length > 0) {
        <div class="trip-options">
          @for (trip of trips.trips(); track trip.id) {
            <button
              type="button"
              class="rt-btn rt-btn--sm trip-option"
              [disabled]="tripsContaining().has(trip.id)"
              (click)="onAdd(trip.id)"
            >
              {{ trip.name }}{{ tripsContaining().has(trip.id) ? ' (added)' : '' }}
            </button>
          }
        </div>
      }
      <div class="add-to-trip-new">
        <input
          class="rt-input rt-input--sm"
          type="text"
          placeholder="New trip name"
          [(ngModel)]="newTripName"
          (keydown.enter)="onCreateAndAdd()"
        />
        <button type="button" class="rt-btn rt-btn--sm rt-btn--cherry" (click)="onCreateAndAdd()">Create &amp; Add</button>
      </div>
      @if (error()) {
        <p class="rt-error">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .add-to-trip-panel {
      margin: 0 14px 14px;
      padding: 12px;
      border: 2px dashed var(--rt-ink);
      border-radius: 12px;
      background: var(--rt-cream);
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: default;
    }
    .rt-label {
      font-size: 13px;
    }
    .trip-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .trip-option:disabled {
      background: var(--rt-sand);
      opacity: 1;
    }
    .add-to-trip-new {
      display: flex;
      gap: 8px;
    }
    .add-to-trip-new .rt-input {
      flex: 1;
      background: var(--rt-card);
    }
  `,
})
export class AddToTripComponent implements OnInit {
  @Input({ required: true }) campgroundId!: string;
  @Output() done = new EventEmitter<void>();

  readonly trips = inject(TripsService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tripsContaining = signal<Set<string>>(new Set());
  newTripName = '';

  ngOnInit(): Promise<void> {
    return this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [, containing] = await Promise.all([
        this.trips.loadTrips(),
        this.trips.getTripIdsForCampground(this.campgroundId),
      ]);
      this.tripsContaining.set(containing);
    } catch {
      this.error.set("Couldn't load trips — try again.");
    } finally {
      this.loading.set(false);
    }
  }

  async onAdd(tripId: string): Promise<void> {
    this.error.set(null);
    try {
      await this.trips.addStop(tripId, this.campgroundId);
      this.tripsContaining.update((ids) => new Set(ids).add(tripId));
      this.done.emit();
    } catch {
      this.error.set("Couldn't add to that trip — try again.");
    }
  }

  async onCreateAndAdd(): Promise<void> {
    const name = this.newTripName.trim();
    if (!name) return;
    this.error.set(null);
    try {
      await this.trips.createTrip(name, [this.campgroundId]);
      this.newTripName = '';
      this.done.emit();
    } catch {
      this.error.set("Couldn't create that trip — try again.");
    }
  }
}
