"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

const ACCENT = "#b4532a";

/**
 * Shows the neighbourhood, not the door: a circle around the coordinates (400 m by default).
 * Agencies rarely publish exact addresses before a viewing.
 *
 * Plain Leaflet in an effect rather than react-leaflet. Next.js keeps pages you navigated away
 * from in a hidden <Activity>, which runs effect cleanups on hide and effects again on show.
 * Creating the map in the effect and removing it in the cleanup survives that cycle; Leaflet is
 * also imported there, because it touches `window` on import and cannot run on the server.
 */
export function AreaMap({
  latitude,
  longitude,
  label,
  radius = 400,
  zoom = 14,
}: {
  latitude: number;
  longitude: number;
  label: string;
  radius?: number;
  zoom?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;

    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, {
        center: [latitude, longitude],
        zoom,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      L.circle([latitude, longitude], {
        radius,
        color: ACCENT,
        fillColor: ACCENT,
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude, radius, zoom]);

  return (
    <div
      role="region"
      aria-label={label}
      className="border-line bg-canvas isolate h-72 overflow-hidden rounded-md border"
    >
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
