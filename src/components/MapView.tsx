"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup, CircleMarker } from "leaflet";

export interface MapPoint {
  code: string; lat: number; lng: number; status: string; severity: string;
  gpsConfidence: number; theftRisk: number;
}
export interface MapHub { name: string; lat: number; lng: number; }

const COLOR: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#16a34a",
};

export function MapView({
  points,
  hubs,
  selected,
  onSelect,
}: {
  points: MapPoint[];
  hubs: MapHub[];
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  // Keep markers by vehicle code so the list can drive the map.
  const markersRef = useRef<Record<string, CircleMarker>>({});
  // Fresh refs so async callbacks don't read stale props.
  const pointsRef = useRef(points);
  const selectedRef = useRef(selected);
  pointsRef.current = points;
  selectedRef.current = selected;

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { zoomControl: true }).setView([36.8065, 10.1815], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      renderMarkers(L);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers on data or selection change (selection changes styling).
  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      renderMarkers(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, hubs, selected]);

  // When the selection changes, fly to that vehicle and open its popup.
  useEffect(() => {
    if (!selected) return;
    const map = mapRef.current;
    const p = pointsRef.current.find((x) => x.code === selected);
    if (!map || !p) return;
    map.flyTo([p.lat, p.lng], 16, { duration: 0.6 });
    const marker = markersRef.current[selected];
    if (marker) marker.openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function renderMarkers(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current = {};

    for (const h of hubs) {
      L.marker([h.lat, h.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#1f2c49;color:#fff;border-radius:8px;padding:2px 6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">🔌 ${h.name}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(layer);
    }

    for (const p of points) {
      const color = COLOR[p.severity] ?? "#16a34a";
      const isSel = p.code === selectedRef.current;
      // Selected marker: larger, thicker ring, drawn on top.
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSel ? 12 : 8,
        color: isSel ? "#1f2c49" : "#fff",
        weight: isSel ? 4 : 2,
        fillColor: color,
        fillOpacity: isSel ? 1 : 0.9,
      }).addTo(layer);
      marker.bindTooltip(p.code, {
        permanent: isSel,
        direction: "top",
        offset: [0, -6],
        className: "eva-map-tip",
      });
      marker.bindPopup(
        `<div style="font-size:12px"><b>${p.code}</b><br/>Status: ${p.status}<br/>GPS confidence: ${Math.round(p.gpsConfidence * 100)}%<br/>Theft risk: ${Math.round(p.theftRisk)}</div>`
      );
      if (onSelect) marker.on("click", () => onSelect(p.code));
      if (isSel) marker.bringToFront();
      markersRef.current[p.code] = marker;
    }
  }

  return <div ref={ref} className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-2xl" />;
}
