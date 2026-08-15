# Phase 2 Map Surface Design

**Status:** Approved for implementation (2026-08-15).

**Supersedes:** the unrecorded gap where Phase 2 shipped `Choose on map` as two numeric
coordinate inputs with no map. This document records the map decision the Phase 2 plan
never made, in the same change-control form as that plan's other architecture decisions.

## 1. Why this exists

Three source documents require a map in Phase 2, and none of them were satisfied:

- `docs/superpowers/plans/2026-08-14-tender-marketplace-roadmap.md`, Phase 2 scope:
  "Geocoding/reverse-geocoding ports, **map pin synchronization**, and coarsened public
  coordinates."
- The same roadmap's Phase 2 automated proof: "Playwright creates a draft, uploads
  fixtures, **selects a map location**, publishes, and discovers the masked tender from
  another account."
- `Product_description.md:281`: "When typing an address, the corresponding point should
  automatically appear on the map, and when marking a point on the map, the address
  should automatically be written in the form."
- `docs/superpowers/specs/2026-08-14-tender-marketplace-program-design.md` §7: "Client
  tender creation supports address-to-pin and pin-to-address synchronization" and
  "Before entitlement, map output is deliberately coarsened."

`src/modules/tenders/ui/tender-wizard.tsx` already exports `onPinSelected(coordinates)`
— a callback written for a map component that was never built. This design connects it.

## 2. Architecture decision: Leaflet with OpenStreetMap tiles

**Decision.** Render maps with `leaflet@1.9.4` against OpenStreetMap raster tiles.

**Rationale.** The Phase 2 plan deferred the _geocoding vendor_ because it required an
approved external account with billing. A tile layer does not: OpenStreetMap's standard
tiles need no API key, no account, and no vendor contract, so a real map ships without
reopening the deferred vendor decision. Google Maps and Mapbox would each require the
key, billing relationship, and approval that Phase 2 explicitly postponed.

**Consequences and limits, recorded honestly:**

- **This is not a geocoder swap.** `GazetteerGeocoder` still resolves addresses against
  six hardcoded Georgian cities. A user typing a street address still lands on that
  city's centre point. The map makes _pin selection_ real; it does not make _address
  lookup_ real. Those remain two separate deferrals behind two separate ports.
- **The public OSM tile servers carry a usage policy** that forbids heavy or commercial
  traffic. This is acceptable for development and acceptance testing. Before production
  traffic, the tile URL must move to a self-hosted or paid tile source. The tile URL is
  therefore a single configured constant, not a value scattered across components.
- **Tile requests disclose a viewed location to the tile host.** On provider surfaces
  this is bounded by the masking rule below: the provider's browser only ever receives,
  and therefore only ever requests tiles around, the coarsened point.

## 3. Masking rule (privacy-critical)

The map must not become the hole in the Phase 2 masking guarantee.

- **Owner surfaces** (authoring wizard, client tender detail) show a **precise pin** at
  the exact stored coordinates. The owner supplied them.
- **Provider surfaces** (masked discovery detail) show **no pin**. They show a
  translucent **approximate-area circle** centred on the coarsened point.
- The circle's radius is derived from the coarsening itself, never hardcoded. Coarsening
  rounds to two decimal places, so the true point lies within ±0.005° on each axis; the
  radius is the worst-case diagonal of that box at the given latitude (~693 m in
  Georgia). A circle smaller than the real uncertainty would imply false precision.
- The provider's page must never receive exact coordinates in props, HTML, or RSC
  payload. The existing `PublicTenderDetail` projection already excludes them; the map
  consumes `publicLatitude` / `publicLongitude` only.

**The Coarse-Circle Rule.** A provider-facing map draws an area, never a point. If a
future surface needs a provider-visible pin, it needs an entitlement check first.

## 4. Visual design

The default Leaflet appearance — saturated tiles, a blue teardrop marker PNG, chunky
`+`/`−` controls — contradicts the Focused Column system. The map is restyled to belong
to it.

| Aspect           | Decision                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame            | Full width of the 460px measure, 1px Hairline border, 8px radius — identical to an input control                                                         |
| Height           | 260px desktop, 220px at ≤608px, keeping the wizard step scannable                                                                                        |
| Tiles            | Desaturated (`grayscale(1) contrast(1.05)`) applied to the tile pane only, so the map reads as paper-and-ink and the ink marker stays the strongest mark |
| Marker           | A custom Tender Ink circular pin with a white ring. No Leaflet default icon, which also removes the bundler icon-path problem                            |
| Approximate area | Ink stroke at 60% with a 10% ink fill — an area, not a target                                                                                            |
| Zoom controls    | Square, hairline-bordered, ink-on-paper, matching secondary buttons                                                                                      |
| Attribution      | Required by OSM. Rendered at Supporting size in Muted Graphite, never hidden                                                                             |
| Elevation        | Flat. The border does the separating, per The Flat-by-Default Rule                                                                                       |
| Focus            | Focus Blue ring on the map container when it receives keyboard focus                                                                                     |

**The Quiet-Basemap Rule.** The basemap is context, not content. It is desaturated so
that the pin, the area circle, and the surrounding form remain the loudest elements.

## 5. Interaction and accessibility

WCAG 2.2 AA is the target, and a raster map is not usable by every user or input device.

- **The numeric latitude and longitude inputs remain visible and functional.** The map
  is progressive enhancement layered over them, never a replacement. This is the
  equivalent non-map path, and it already exists.
- Clicking or tapping the map sets the pin, writes both coordinate inputs through the
  existing `onPinSelected` contract, and switches the form to `PIN` mode.
- Dragging the marker updates the same values.
- The map container carries an accessible name describing its purpose and current state.
- The map is never a keyboard trap; keyboard users are served by the coordinate inputs,
  and the container is not focus-grabbing on load.
- Static owner and provider maps are non-interactive: no drag, no scroll-wheel zoom, no
  keyboard panning, so a map inside a scrolling page never hijacks the scroll.
- Georgian and English receive identical map affordances and label weight, per The
  Equal-Script Rule.

## 6. Server contract (unchanged)

No API, application, or domain change is required. The map is a UI layer over contracts
that already exist:

- `PATCH /api/tenders/:id/location` already accepts `{ mode: "PIN", latitude, longitude }`.
- `syncTenderLocation` already reverse-geocodes a pin and writes the resolved
  `normalizedAddress` back to `addressLine`, satisfying the pin-to-address half of
  `Product_description.md:281` to the limit the stub geocoder allows.
- `coarsenCoordinates` already produces the public point the provider circle uses.

## 7. Out of scope

- Replacing `GazetteerGeocoder` with a real geocoding vendor.
- Address autocomplete or search-as-you-type.
- Route drawing and road distance, which the roadmap assigns to Phase 7 (Transport).
- Clustering many tenders on a discovery-list map. This phase maps one tender at a time.
- A self-hosted or paid tile source, which is required before production traffic.
