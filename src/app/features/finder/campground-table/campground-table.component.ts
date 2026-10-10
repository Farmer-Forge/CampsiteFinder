import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FavoriteToggleComponent } from '../../../shared/favorite-toggle/favorite-toggle.component';
import { AddToTripComponent } from '../../../shared/add-to-trip/add-to-trip.component';
import { CampgroundDetailPanelComponent } from './campground-detail-panel/campground-detail-panel.component';
import { Campground } from '../../../core/models/campground.model';
import { SupabaseService } from '../../../core/services/supabase.service';

const METERS_PER_MILE = 1609.34;

// Scrolling card list of campgrounds (Finder + Favorites). Still named
// "table" from when it wrapped p-table; the inputs/outputs are unchanged.
@Component({
  selector: 'app-campground-table',
  standalone: true,
  imports: [FormsModule, FavoriteToggleComponent, AddToTripComponent, CampgroundDetailPanelComponent],
  template: `
    <div class="rt-scroll-list">
      @for (campground of campgrounds; track campground.id) {
        <div
          class="campground-card"
          [class.is-open]="expandedId === campground.id"
          [attr.data-campground-id]="campground.id"
        >
          <div class="card-main" (click)="toggleExpanded(campground)">
            @if (planMode) {
              <button
                type="button"
                class="plan-check"
                title="Include in trip"
                [class.is-checked]="planSelected.has(campground.id)"
                [attr.aria-pressed]="planSelected.has(campground.id)"
                (click)="planToggle.emit(campground.id); $event.stopPropagation()"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </button>
            }
            @if (showDistance) {
              <div class="distance-badge">
                <span class="badge-top">{{ formatMiles(campground.distanceMeters) }}</span>
                <span class="badge-sub">MI</span>
              </div>
            }
            <div class="card-text">
              <div class="campground-name-link">{{ campground.name }}</div>
              <div class="tags">
                <span class="rt-tag rt-tag--teal">{{ campground.agency }}</span>
                @if (campground.parkCode) {
                  <span class="rt-tag rt-tag--outline">{{ campground.parkCode }}</span>
                }
              </div>
            </div>
            <app-favorite-toggle [campgroundId]="campground.id" />
            @if (supabase.isAuthenticated) {
              <button
                type="button"
                class="rt-icon-btn add-to-trip-toggle"
                title="Add to trip"
                [class.is-active]="pickerId === campground.id"
                [attr.aria-expanded]="pickerId === campground.id"
                (click)="togglePicker(campground.id); $event.stopPropagation()"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </button>
            }
          </div>
          @if (pickerId === campground.id) {
            <app-add-to-trip [campgroundId]="campground.id" (done)="pickerId = null" />
          }
          @if (showNotes) {
            <div class="note-row">
              <input
                class="note-input"
                type="text"
                placeholder="Add a note"
                [attr.aria-label]="'Note for ' + campground.name"
                [(ngModel)]="noteDrafts[campground.id]"
                (blur)="onNoteBlur(campground.id)"
              />
            </div>
          }
          @if (expandedId === campground.id) {
            <div class="detail" [class.indented]="showDistance">
              <app-campground-detail-panel [campground]="campground" />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .campground-card {
      flex: none;
      border: 2px solid var(--rt-ink);
      border-radius: 14px;
      background: var(--rt-card);
      box-shadow: 3px 3px 0 var(--rt-ink);
    }
    .campground-card.is-open {
      background: var(--rt-cream);
    }
    .card-main {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 12px 14px;
      cursor: pointer;
    }
    .distance-badge {
      width: 58px;
      height: 58px;
      flex: none;
      box-sizing: border-box;
      border-radius: 50%;
      background: var(--rt-mustard);
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
      font-size: 16px;
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
    .plan-check {
      width: 28px;
      height: 28px;
      flex: none;
      padding: 0;
      border: 2px solid var(--rt-ink);
      border-radius: 8px;
      background: var(--rt-cream);
      color: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .plan-check.is-checked {
      background: var(--rt-teal);
      color: var(--rt-cream);
    }
    .note-row {
      padding: 0 14px 12px;
    }
    .note-input {
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      font-size: 14px;
      padding: 7px 12px;
      border: none;
      border-bottom: 2px dotted var(--rt-ink);
      background: transparent;
      color: var(--rt-ink);
    }
    .detail {
      padding: 2px 14px 16px;
    }
    .detail.indented {
      padding-left: 86px;
    }
    @media (max-width: 900px) {
      .detail.indented {
        padding-left: 14px;
      }
    }
  `,
})
export class CampgroundTableComponent implements OnChanges {
  @Input({ required: true }) campgrounds: Campground[] = [];
  @Input() selected: Campground | null = null;
  @Input() showDistance = true;
  @Input() showNotes = false;
  @Input() notes: Map<string, string | null> = new Map();
  // Favorites' "Plan a trip" mode: a checkbox per card, state owned by the parent.
  @Input() planMode = false;
  @Input() planSelected: Set<string> = new Set();
  @Output() selectedChange = new EventEmitter<Campground | null>();
  @Output() noteChange = new EventEmitter<{ campgroundId: string; note: string }>();
  @Output() planToggle = new EventEmitter<string>();

  readonly supabase = inject(SupabaseService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  noteDrafts: Record<string, string> = {};
  expandedId: string | null = null;
  // Which card's inline add-to-trip panel is open — one at a time.
  pickerId: string | null = null;

  formatMiles(meters: number): string {
    const miles = meters / METERS_PER_MILE;
    return miles < 100 ? miles.toFixed(1) : Math.round(miles).toString();
  }

  toggleExpanded(campground: Campground): void {
    const expanding = this.expandedId !== campground.id;
    this.expandedId = expanding ? campground.id : null;
    this.selectedChange.emit(expanding ? campground : null);
  }

  togglePicker(campgroundId: string): void {
    this.pickerId = this.pickerId === campgroundId ? null : campgroundId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['notes']) {
      // Merge, never replace. Saving one row's note updates the shared notes
      // map, which pushes a new `notes` input through here — rebuilding the
      // whole draft object would wipe whatever the user is mid-typing in
      // another row. A key already present in `noteDrafts` is either being
      // edited right now or already reflects what the user typed, so only
      // seed keys we haven't got yet.
      this.notes.forEach((note, campgroundId) => {
        if (!(campgroundId in this.noteDrafts)) {
          this.noteDrafts[campgroundId] = note ?? '';
        }
      });
    }
    // Ties the list to selections made elsewhere (e.g. "View details" on a
    // map marker) — expanding that card and scrolling it into view, the same
    // outcome as clicking it here. A selection clearing to null is left
    // alone, since toggleExpanded already manages expandedId itself.
    if (changes['selected'] && this.selected) {
      this.expandedId = this.selected.id;
      this.cdr.detectChanges();
      const card = this.host.nativeElement.querySelector(
        `[data-campground-id="${this.selected.id}"]`,
      );
      card?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }

  onNoteBlur(campgroundId: string): void {
    this.noteChange.emit({ campgroundId, note: this.noteDrafts[campgroundId] ?? '' });
  }
}
