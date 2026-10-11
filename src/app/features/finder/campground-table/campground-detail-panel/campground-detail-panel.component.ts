import { Component, Input } from '@angular/core';
import { Campground } from '../../../../core/models/campground.model';

@Component({
  selector: 'app-campground-detail-panel',
  standalone: true,
  template: `
    <div class="campground-detail-panel">
      <div class="description" [innerHTML]="campground.description"></div>
      <div class="links">
        @if (campground.reservationUrl) {
          <a class="rt-btn rt-btn--cherry rt-btn--shadow" [href]="campground.reservationUrl" target="_blank" rel="noopener">Reserve on recreation.gov</a>
        }
        <a class="rt-btn" [href]="directionsUrl" target="_blank" rel="noopener">Directions</a>
      </div>
    </div>
  `,
  styles: `
    .campground-detail-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      cursor: default;
    }

    .description {
      font-size: 15px;
      line-height: 1.5;
      text-wrap: pretty;
      overflow-wrap: anywhere;
    }

    .description :first-child {
      margin-top: 0;
    }

    .description :last-child {
      margin-bottom: 0;
    }

    .links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class CampgroundDetailPanelComponent {
  @Input({ required: true }) campground!: Campground;

  // An empty href resolves to the current page, so most RIDB rows (which have
  // no directions URL) would open the Finder itself in a new tab.
  get directionsUrl(): string {
    return (
      this.campground.directionsUrl ||
      `https://www.google.com/maps/dir/?api=1&destination=${this.campground.lat},${this.campground.lng}`
    );
  }
}
