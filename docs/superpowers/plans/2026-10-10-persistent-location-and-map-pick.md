# Persistent Location, Device-Location Button & Map Pick — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) The Finder's search location and filters survive navigating to other pages and a
browser refresh. (2) A "Use my device location" button is always available. (3) Right-clicking the
map offers "Search from here" to move the search location.

**Decisions (agreed 2026-10-10):**
- Persist app-wide **and** in `sessionStorage` (per tab; cleared when the tab closes).
- Filters persist alongside the location, not just the location.
- Device-location button is always shown — in the location controls and in the error state, including when blocked.
- Right-click opens a confirm popup ("Search from here"); it never moves the location directly.

**Architecture:** A new root-provided `FinderStateService` (one instance for the app's lifetime — the
DI-singleton analogue) holds the last successful search: location + filter values. `FinderComponent`
restores from it in `ngOnInit` instead of always calling geolocation, and writes to it after every
successful `loadNearest`. The service mirrors to `sessionStorage` with every read/write in
`try/catch` (private windows / blocked storage must degrade to in-memory only). `CampgroundMapComponent`
gains an opt-in right-click handler that emits picked coordinates; Finder feeds them through the
same `loadNearest(coords)` path the manual lat/lng form already uses.

**Tech Stack:** Angular 22 standalone + signals, Leaflet via `@bluehalo/ngx-leaflet`, Vitest.

## Global Constraints
- No service/RPC/migration changes on the Supabase side — client only.
- Snapshot-on-success: only write state after a load succeeds, so a failed lookup never overwrites a good location.
- Restored state is validated on read (numbers are finite, lat ∈ [-90, 90], lng ∈ [-180, 180]; unknown agencies/states dropped). Corrupt or old-shape storage → ignore it, fall back to geolocation.
- `selectedParks` restore: intersect the saved list with `parkCodes()` once they load; if nothing was saved, keep today's "all parks" default.
- The map pick is opt-in (`allowLocationPick` input, default `false`) so trip detail's map is unaffected.

---

## Task 1: `FinderStateService`
- [ ] Create `src/app/core/services/finder-state.service.ts` (`providedIn: 'root'`)
  - `FinderSnapshot { location: Coordinates; agencies: string[]; states: string[]; regions: string[]; parks: string[] | null; nearMeEnabled: boolean; radiusMiles: number }` (`parks: null` = "all")
  - `snapshot(): FinderSnapshot | null` — in-memory first, else parse + validate `sessionStorage['campsite-finder.finder']`
  - `save(snapshot)` — set in memory, write JSON to `sessionStorage` (try/catch)
- [ ] Spec `finder-state.service.spec.ts`: round-trip; survives a new service instance via storage; invalid JSON / out-of-range lat / throwing `sessionStorage` all return `null` (or in-memory value) without throwing

## Task 2: Finder restores and saves state
- [ ] Inject `FinderStateService`; in `ngOnInit`, if a snapshot exists, apply its filter values and call `loadNearest(snapshot.location)`; otherwise current behavior (`loadNearest()` → geolocation)
- [ ] After a successful `getNearest` in `loadNearest`, `save(...)` the current location + filters (parks saved as `null` when all are selected)
- [ ] `loadParkCodes`: apply saved parks (intersected with available codes) instead of always selecting all
- [ ] Specs: returning to Finder with saved state does **not** call `geolocation.getCurrentPosition`; restored filters are passed to `getNearest`; a failed load does not call `save`

## Task 3: Always-available "Use my device location"
- [ ] Rename the control "Use my current location" → **"Use my device location"** (location-controls row)
- [ ] Error state: always show the button, including when `locationBlocked()`; keep the blocked guidance text alongside it
- [ ] When a device lookup fails **while a search location already exists**, keep the current results and location; show the failure inline under the location controls (new `deviceLocationError` signal), with the blocked guidance when permission is `'denied'` — instead of swapping the page to the full error view
- [ ] Blocked guidance text: short steps — "Click the icon left of the address bar → Site settings → Location → Allow, then press Use my device location again."
- [ ] Specs: button rendered in both states; failure with an existing location keeps `campgrounds()` and shows the inline message; blocked state still shows the button

## Task 4: Right-click "Search from here" on the map
- [ ] `CampgroundMapComponent`: `@Input() allowLocationPick = false`, `@Output() locationPick = new EventEmitter<Coordinates>()`
- [ ] In `onMapReady`, when `allowLocationPick`, register `map.on('contextmenu', …)`: open an `L.popup` at the clicked latlng containing the coordinates (4 dp) and a **"Search from here"** button (plain DOM, same pattern as `buildPopupContent`); clicking it closes the popup and emits `locationPick`. Leaflet suppresses the browser's own context menu once a `contextmenu` listener exists.
- [ ] Finder template: `[allowLocationPick]="true"` and `(locationPick)="onMapLocationPick($event)"` → `loadNearest(coords)` (the existing manual-location path, so it also gets saved by Task 2)
- [ ] Specs: no listener when `allowLocationPick` is false; contextmenu → popup → button click emits the coordinates; Finder handler calls `getNearest` with the picked point
- [ ] Manual check: right-click on desktop Chrome; long-press on Android (expected to work); iOS Safari not expected to work (documented, not fixed)

## Task 5: Verify and ship
- [ ] `ng test` and `ng build` green
- [ ] Manual pass in the browser: set a location by each of the three methods → go to Favorites → back to Finder → same location and filters, no geolocation prompt; refresh keeps them; a new tab starts fresh
- [ ] Deploy to Vercel (after Shawn's go-ahead)

## Out of Scope
- Long-press location picking on iOS Safari.
- Persisting across tabs/browser restarts (`localStorage`) or to the user's account in Supabase.
- Reverse geocoding the picked point to a place name.
- Changing the existing recenter-to-zoom-9 on location change (a map pick will recenter there too).
- Preserving the map's pan/zoom across page navigation.
