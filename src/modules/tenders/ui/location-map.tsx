"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "../domain/coordinates";
import { coarseningUncertaintyMeters } from "../domain/coarsening-uncertainty";
import { resolveMapView, type MapPrecision } from "./location-map-view";

// Kept as one constant because the public OpenStreetMap tile servers carry a
// usage policy that forbids production-scale traffic. Moving to a self-hosted
// or paid source before launch must be a one-line change, not a search.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_TILE_ZOOM = 19;
// Leaflet's stock prefix carries a flag emoji. The library credit stays; the
// unbidden political content does not belong in the product's chrome.
const ATTRIBUTION_PREFIX = '<a href="https://leafletjs.com/">Leaflet</a>';

export type LocationMapCopy = Readonly<{
  interactiveLabel: string;
  preciseLabel: string;
  approximateLabel: string;
}>;

export type LocationMapProps = Readonly<{
  coordinates: Coordinates | null;
  precision: MapPrecision;
  copy: LocationMapCopy;
  onPick?: (coordinates: Coordinates) => void;
}>;

function accessibleName(
  precision: MapPrecision,
  copy: LocationMapCopy,
  interactive: boolean,
) {
  if (interactive) return copy.interactiveLabel;
  return precision === "APPROXIMATE"
    ? copy.approximateLabel
    : copy.preciseLabel;
}

export function LocationMap({
  coordinates,
  precision,
  copy,
  onPick,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // State rather than a ref: the map is created asynchronously, and the effect
  // that draws the marker must re-run once it exists.
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  // Held in a ref so a new callback identity never tears down the map.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const interactive = onPick !== undefined;
  const latitude = coordinates?.latitude ?? null;
  const longitude = coordinates?.longitude ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let disposed = false;
    let created: LeafletMap | null = null;

    // Leaflet reaches for `window` at import time, so it is only ever loaded
    // inside this browser-only effect.
    void import("leaflet").then((leaflet) => {
      if (disposed || containerRef.current === null) return;

      created = leaflet.map(container, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: false,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
        attributionControl: true,
      });
      leaflet
        .tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: MAX_TILE_ZOOM,
        })
        .addTo(created);

      if (interactive) {
        created.on("click", (event) => {
          onPickRef.current?.({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });
      }

      // Leaflet measures the container on creation; inside a wizard step that
      // has just mounted it can still be zero-height for a frame.
      created.attributionControl.setPrefix(ATTRIBUTION_PREFIX);
      created.whenReady(() => created?.invalidateSize());
      setMap(created);
    });

    return () => {
      disposed = true;
      created?.remove();
      setMap(null);
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    if (map === null) return;

    const placed =
      latitude !== null && longitude !== null ? { latitude, longitude } : null;
    const view = resolveMapView(placed, precision);
    map.setView([view.center.latitude, view.center.longitude], view.zoom);

    void import("leaflet").then((leaflet) => {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      if (placed === null) return;

      if (precision === "APPROXIMATE") {
        // An area, never a point: the radius is derived from the coarsening so
        // the circle cannot imply more precision than the provider was given.
        circleRef.current = leaflet
          .circle([placed.latitude, placed.longitude], {
            radius: coarseningUncertaintyMeters(placed.latitude),
            className: "location-map-area",
            // Stroke and fill live in CSS so the map obeys the design tokens.
            color: "",
            fillColor: "",
          })
          .addTo(map);
        return;
      }

      markerRef.current = leaflet
        .marker([placed.latitude, placed.longitude], {
          draggable: interactive,
          keyboard: false,
          icon: leaflet.divIcon({
            className: "location-map-pin",
            html: '<span aria-hidden="true"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
        .addTo(map);

      if (interactive) {
        markerRef.current.on("dragend", (event) => {
          const { lat, lng } = event.target.getLatLng();
          onPickRef.current?.({ latitude: lat, longitude: lng });
        });
      }
    });
  }, [map, latitude, longitude, precision, interactive]);

  return (
    <div
      className="location-map"
      data-interactive={interactive ? "true" : "false"}
      ref={containerRef}
      role="img"
      aria-label={accessibleName(precision, copy, interactive)}
    />
  );
}
