# Reserve & Directions Links — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The campground detail panel's "Reserve on recreation.gov" and "Directions" buttons never
open a blank link. Tester feedback (2026-10-11): Reserve opened the Finder itself in a new tab for
every campground except Davis Bayou.

**Root cause:** Both buttons render unconditionally with `target="_blank"`. An empty `href` resolves to
the current page. In production, 4,449 / 4,894 campgrounds have an empty `reservation_url` (every
RIDB-sourced row: RIDB leaves `FacilityReservationURL` blank) and 4,604 have an empty `directions_url`
(RIDB rows by design — `FacilityDirections` is prose, not a URL).

**Decisions (agreed 2026-10-11):**
- One patch covering both the UI guard and the data fill.
- Reservation URL: RIDB's `FacilityReservationURL` if present, else
  `https://www.recreation.gov/camping/campgrounds/{FacilityID}` when `Reservable` is `true`
  (verified as a required boolean in RIDB's published OpenAPI spec,
  `ridb.recreation.gov/shared/swagger/ridb.yaml`), else `""`.
- Reserve button is hidden when the URL is empty.
- Directions falls back to a Google Maps directions link built from the campground's lat/lng — done
  client-side so it covers every row with no re-sync.

**Tech Stack:** Angular 22 standalone, Vitest; Supabase Edge Function (Deno) for `ridb-sync`.

## Out of Scope
- The button label says "recreation.gov" even for the 55 NPS rows whose URL points elsewhere.
- Non-reservable (first-come, first-served) campgrounds get no replacement text/info.
- NPS `nps-sync` rows with an empty reservation URL — no RIDB `Reservable` flag available there.

---

## Task 1: `ridb-sync` builds recreation.gov URLs for reservable facilities
- [x] Add `Reservable?: boolean` to `RidbFacilityRecord`
- [x] Tests in `transform.test.ts`: reservable + no URL → built URL; non-reservable + no URL → `""`; explicit URL wins
- [x] Implement in `toCampgroundRow`
- [x] `deno test supabase/functions/ridb-sync` passes

## Task 2: Detail panel guards Reserve, falls back for Directions
- [x] Specs: no Reserve link when `reservationUrl` is empty; Directions uses Google Maps lat/lng when `directionsUrl` is empty
- [x] Implement in `campground-detail-panel.component.ts`
- [x] `npm test` passes

## Task 3: Backfill production (needs explicit go-ahead)
- [ ] Deploy `ridb-sync` and invoke it once
- [ ] Verify: `select count(*) from campgrounds where source='ridb' and reservation_url <> ''` is non-zero
- [ ] Merge to `main` (Vercel deploys the UI change)
