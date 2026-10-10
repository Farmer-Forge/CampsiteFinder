import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CampgroundTableComponent } from './campground-table.component';
import { AddToTripComponent } from '../../../shared/add-to-trip/add-to-trip.component';
import { CampgroundDetailPanelComponent } from './campground-detail-panel/campground-detail-panel.component';
import { FavoritesService } from '../../../core/services/favorites.service';
import { TripsService } from '../../../core/services/trips.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('CampgroundTableComponent', () => {
  let fixture: ComponentFixture<CampgroundTableComponent>;
  let component: CampgroundTableComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampgroundTableComponent],
      providers: [
        { provide: SupabaseService, useValue: { isAuthenticated: true } },
        {
          provide: FavoritesService,
          useValue: {
            favoriteIds: () => new Set(),
            toggleFavorite: vi.fn(),
            loadFavoriteIds: () => Promise.resolve(),
          },
        },
        {
          provide: TripsService,
          useValue: {
            trips: () => [],
            loadTrips: vi.fn().mockResolvedValue(undefined),
            getTripIdsForCampground: vi.fn().mockResolvedValue(new Set()),
            addStop: vi.fn(),
            createTrip: vi.fn(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(CampgroundTableComponent);
    component = fixture.componentInstance;
  });

  const cg = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, name: `Camp ${id}`, agency: 'NPS', parkCode: null, distanceMeters: 0, ...extra }) as any;

  function clickCard(index: number): void {
    fixture.debugElement.queryAll(By.css('.card-main'))[index].triggerEventHandler('click', null);
    fixture.detectChanges();
  }

  it('opens an inline Add to Trip panel when the + button is clicked', () => {
    component.campgrounds = [cg('1')];
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(AddToTripComponent))).toBeFalsy();

    fixture.debugElement.query(By.css('.add-to-trip-toggle')).nativeElement.click();
    fixture.detectChanges();

    const addToTrip = fixture.debugElement.query(By.directive(AddToTripComponent));
    expect(addToTrip.componentInstance.campgroundId).toBe('1');
  });

  it('keeps only one Add to Trip panel open at a time', () => {
    component.campgrounds = [cg('1'), cg('2')];
    fixture.detectChanges();
    const toggles = fixture.debugElement.queryAll(By.css('.add-to-trip-toggle'));

    toggles[0].nativeElement.click();
    fixture.detectChanges();
    toggles[1].nativeElement.click();
    fixture.detectChanges();

    const panels = fixture.debugElement.queryAll(By.directive(AddToTripComponent));
    expect(panels.length).toBe(1);
    expect(panels[0].componentInstance.campgroundId).toBe('2');
  });

  it('emits selectedChange when a card is expanded, and null when collapsed', () => {
    component.campgrounds = [cg('1')];
    fixture.detectChanges();
    const emitted: unknown[] = [];
    component.selectedChange.subscribe((c) => emitted.push(c));

    clickCard(0);
    clickCard(0);

    expect(emitted).toEqual([component.campgrounds[0], null]);
  });

  it('shows a distance badge in miles by default', () => {
    component.campgrounds = [cg('1', { distanceMeters: 1609.34 * 12.34 }), cg('2', { distanceMeters: 1609.34 * 150.6 })];
    fixture.detectChanges();

    const badges = fixture.debugElement.queryAll(By.css('.badge-top')).map((b) => b.nativeElement.textContent.trim());
    expect(badges).toEqual(['12.3', '151']);
  });

  it('hides the distance badge when showDistance is false', () => {
    component.campgrounds = [cg('1')];
    component.showDistance = false;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.distance-badge'))).toBeFalsy();
  });

  it('hides note inputs by default', () => {
    component.campgrounds = [cg('1')];
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.note-input'))).toBeFalsy();
  });

  it('shows a note input per card when showNotes is true', () => {
    component.campgrounds = [cg('1')];
    component.showNotes = true;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.note-input'))).toBeTruthy();
  });

  it('seeds noteDrafts from the notes input on change', () => {
    component.notes = new Map([['cg-1', 'great sites']]);

    component.ngOnChanges({ notes: {} as any });

    expect(component.noteDrafts['cg-1']).toBe('great sites');
  });

  it('seeds a note for a campground it has not seen before on a later notes change', () => {
    component.notes = new Map([['cg-1', 'great sites']]);
    component.ngOnChanges({ notes: {} as any });

    component.notes = new Map([
      ['cg-1', 'great sites'],
      ['cg-2', 'quiet loop'],
    ]);
    component.ngOnChanges({ notes: {} as any });

    expect(component.noteDrafts['cg-2']).toBe('quiet loop');
  });

  it('does not overwrite a draft the user has already started editing', () => {
    component.notes = new Map([['cg-1', 'great sites']]);
    component.ngOnChanges({ notes: {} as any });

    // User types in row cg-1 while another row's save round-trip is in flight.
    component.noteDrafts['cg-1'] = 'half-typed edit';

    // That other save resolves and pushes a fresh notes map through.
    component.notes = new Map([['cg-1', 'great sites']]);
    component.ngOnChanges({ notes: {} as any });

    expect(component.noteDrafts['cg-1']).toBe('half-typed edit');
  });

  it('emits noteChange with the current draft value on blur', () => {
    let emitted: any;
    component.noteChange.subscribe((e) => (emitted = e));
    component.noteDrafts['cg-1'] = 'updated note';

    component.onNoteBlur('cg-1');

    expect(emitted).toEqual({ campgroundId: 'cg-1', note: 'updated note' });
  });

  it('shows each campground\'s agency and park code as tags', () => {
    component.campgrounds = [cg('1', { agency: 'USFS', parkCode: 'acad' })];
    fixture.detectChanges();

    const tags = fixture.debugElement.queryAll(By.css('.rt-tag')).map((t) => t.nativeElement.textContent.trim());
    expect(tags).toEqual(['USFS', 'acad']);
  });

  it('expands a card to show its details when clicked', () => {
    component.campgrounds = [cg('1')];
    fixture.detectChanges();

    clickCard(0);

    const panel = fixture.debugElement.query(By.directive(CampgroundDetailPanelComponent));
    expect(panel.componentInstance.campground.id).toBe('1');
  });

  it('collapses an expanded card when clicked again', () => {
    component.campgrounds = [cg('1')];
    fixture.detectChanges();

    clickCard(0);
    clickCard(0);

    expect(fixture.debugElement.query(By.directive(CampgroundDetailPanelComponent))).toBeFalsy();
  });

  it('expands the card matching the selected input', () => {
    const campgrounds = [cg('1'), cg('2')];
    component.campgrounds = campgrounds;
    fixture.detectChanges();

    component.selected = campgrounds[1];
    component.ngOnChanges({ selected: {} as any });
    fixture.detectChanges();

    const panel = fixture.debugElement.query(By.directive(CampgroundDetailPanelComponent));
    expect(panel.componentInstance.campground.id).toBe('2');
  });

  it('only expands one card at a time', () => {
    component.campgrounds = [cg('1'), cg('2')];
    fixture.detectChanges();

    clickCard(0);
    clickCard(1);

    const panels = fixture.debugElement.queryAll(By.directive(CampgroundDetailPanelComponent));
    expect(panels.length).toBe(1);
    expect(panels[0].componentInstance.campground.id).toBe('2');
  });

  it('shows plan checkboxes in plan mode and emits planToggle without expanding the card', () => {
    component.campgrounds = [cg('1')];
    component.planMode = true;
    component.planSelected = new Set(['1']);
    fixture.detectChanges();
    let toggled: string | undefined;
    component.planToggle.subscribe((id) => (toggled = id));

    const check = fixture.debugElement.query(By.css('.plan-check'));
    expect(check.nativeElement.classList).toContain('is-checked');
    check.nativeElement.click();
    fixture.detectChanges();

    expect(toggled).toBe('1');
    expect(fixture.debugElement.query(By.directive(CampgroundDetailPanelComponent))).toBeFalsy();
  });
});
