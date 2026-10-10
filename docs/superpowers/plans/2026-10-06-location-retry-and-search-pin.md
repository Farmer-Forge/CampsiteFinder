# Location Retry & Search-Location Pin — Retroactive Record

> Written after the fact (2026-10-10). This work shipped without a spec/plan; this file records
> what was built so the plans folder stays a complete history.

Commits: `2464d97` (2026-10-06), finder/map half of `63c499b` (2026-10-08).

**Goal:** Make geolocation failures understandable and recoverable, and show the user where
"nearest" is being measured from.

- [x] `GeolocationService`: translate `GeolocationPositionError` codes into specific messages
- [x] `GeolocationService.checkPermissionState()`: Permissions API lookup, `'unsupported'` fallback (Safari)
- [x] Finder error state: "Try location again" while permission is undecided; blocked-specific guidance when `'denied'`
- [x] Manual lat/lng fallback form shown on error
- [x] Finder: `searchLocation` signal (replaces private `lastCoords`) feeding the map
- [x] Finder: "Change location" toggle + "Use my current location" controls above the list
- [x] Map: "your search location" pin (`.current-location-marker`) and recenter to zoom 9 on location change
- [x] Map: route polyline and location pin composed into one `overlayLayers` array
- [x] Specs for service, Finder and map changes

## Known gaps (picked up by later plans)
- Location lives on `FinderComponent`, so it is lost when navigating away — see
  [2026-10-10-persistent-location-and-map-pick.md](2026-10-10-persistent-location-and-map-pick.md).
