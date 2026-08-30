"use client";

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

export default function TrackingPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<{ points: MapPoint[]; hubs: MapHub[] }>("/api/tracking");
  useRealtime((e) => (e.type === "telemetry" || e.type === "vehicle-status") && refetch());

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const flagged = data.points.filter((p) => p.severity === "CRITICAL" || p.severity === "HIGH");

  return (
    <div>
      <PageHeader title={t("track.title")} subtitle={t("track.lastKnown")} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MapView points={data.points} hubs={data.hubs} />
        </div>
        <div>
          <div className="card divide-y divide-navy-100">
            {(flagged.length ? flagged : data.points.slice(0, 8)).map((p) => (
              <div key={p.code} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-navy-900">{p.code}</div>
                  <div className="text-xs text-navy-400">
                    {t("track.gpsConfidence")}: {Math.round(p.gpsConfidence * 100)}%
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
