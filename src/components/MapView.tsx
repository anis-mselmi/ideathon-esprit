"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

export interface MapPoint {
  code: string; lat: number; lng: number; status: string; severity: string;
  gpsConfidence: number; theftRisk: number;
}
export interface MapHub { name: string; lat: number; lng: number; }

const COLOR: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#dc2626", MEDIUM: "#d97706", LOW: "#16a34a",
};

export function MapView({ points, hubs, onSelect }: { points: MapPoint[]; hubs: MapHub[]; onSelect?: (code: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

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

  // Re-render markers on data change.
  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      renderMarkers(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, hubs]);

  async function renderMarkers(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

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
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
      }).addTo(layer);
      marker.bindPopup(
        `<div style="font-size:12px"><b>${p.code}</b><br/>Status: ${p.status}<br/>GPS confidence: ${Math.round(p.gpsConfidence * 100)}%<br/>Theft risk: ${Math.round(p.theftRisk)}</div>`
      );
      if (onSelect) marker.on("click", () => onSelect(p.code));
    }
  }

  return <div ref={ref} className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-2xl" />;
}
