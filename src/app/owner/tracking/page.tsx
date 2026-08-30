"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState, ErrorState, StatusBadge } from "@/components/ui";
import type { MapPoint, MapHub } from "@/components/MapView";

// Leaflet must render client-side only.
const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-[60vh] animate-pulse rounded-2xl bg-navy-100" />,
});

const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function TrackingPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<{ points: MapPoint[]; hubs: MapHub[] }>("/api/tracking");
  const [selected, setSelected] = useState<string | null>(null);
  useRealtime((e) => (e.type === "telemetry" || e.type === "vehicle-status") && refetch());

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  // All vehicles, most-at-risk first, so every motorcycle is reachable.
  const list = [...data.points].sort(
    (a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || a.code.localeCompare(b.code)
  );

  return (
    <div>
      <PageHeader title={t("track.title")} subtitle={t("track.lastKnown")} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MapView points={data.points} hubs={data.hubs} selected={selected} onSelect={setSelected} />
        </div>
        <div>
          <div className="mb-2 px-1 text-xs font-medium text-navy-400">
            {t("track.clickToLocate")}
          </div>
          <div className="card max-h-[56vh] divide-y divide-navy-100 overflow-y-auto">
            {list.map((p) => {
              const active = selected === p.code;
              return (
                <button
                  key={p.code}
                  onClick={() => setSelected(p.code)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm transition-colors ${
                    active ? "bg-navy-50" : "hover:bg-navy-50/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: dotColor(p.severity) }}
                      aria-hidden
                    />
                    <div>
                      <div className={`font-semibold ${active ? "text-navy-900" : "text-navy-800"}`}>{p.code}</div>
                      <div className="text-xs text-navy-400">
                        {t("track.gpsConfidence")}: {Math.round(p.gpsConfidence * 100)}%
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function dotColor(severity: string): string {
  if (severity === "CRITICAL" || severity === "HIGH") return "#dc2626";
  if (severity === "MEDIUM") return "#d97706";
  return "#16a34a";
}
