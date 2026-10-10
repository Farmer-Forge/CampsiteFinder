# '50s Road Trip Redesign — Implementation Plan

Spec: [docs/design/Campsite01/README.md](../../design/Campsite01/README.md) (prototype: `CampsiteFinder.dc.html`).

Approach: design tokens + shared `rt-*` utility classes in `src/styles.scss`; each screen's
template swaps PrimeNG tables/popovers/toggles for plain markup using those classes. PrimeNG
stays for multiselect (Finder filters), select (admin role) and autocomplete (admin attributes),
restyled globally. No service, RPC, guard or route changes.

- [x] Global: Google Fonts, tokens, button/input/card/table classes, PrimeNG overrides, `.trip-stop-marker` recolor
- [x] Shell: teal nav with wordmark, `routerLinkActive` pills, scrolling `<main>`
- [x] Map: fill its frame; `invalidateSize()` via ResizeObserver (map behavior otherwise untouched)
- [x] Finder: agency chips, styled multiselects, "Miles from me" segmented control, map frame + card list
- [x] Card list (`app-campground-table`): distance badge, tags, heart/+ buttons, inline add-to-trip panel, notes, plan checkboxes, expand-to-detail
- [x] Add-to-trip: popover → inline panel (one open at a time)
- [x] Favorites: header, Plan a trip panel, per-card checkboxes + notes
- [x] Trips: postcard grid (stop count + route via existing `getTripStops`)
- [x] Trip detail: header, numbered stop cards, up/down reorder (replaces p-table drag), add-stop footer
- [x] Account, Admin, About, Login/Signup restyles
- [x] Responsive: stack map above list under 900px
- [x] Update specs for removed table/popover markup; `ng test` + `ng build` green
- [x] Deploy to Vercel

## Out of Scope
- Dark-mode palette (the toggle still saves the preference; the design defines no dark tokens).
- Animated About-page SVG scene — the prototype drops it; recoloring it is a possible follow-up.
- Leaflet popups/markers (unchanged per spec, except trip-stop marker color).
