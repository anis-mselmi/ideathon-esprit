"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/ui";

interface Battery {
  id: string; code: string; soh: number; soc: number; status: string; cycleCount: number;
  vehicles: { code: string }[]; hub: { name: string } | null;
}

const FILTERS = ["ALL", "READY", "CHARGING", "ASSIGNED", "ATTENTION", "SERVICE"];

export default function BatteriesPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("ALL");
  const { data, loading, error, refetch } = useApi<{ batteries: Battery[] }>(
    `/api/batteries${filter !== "ALL" ? `?status=${filter}` : ""}`,
    [filter]
  );

  return (
    <div>
      <PageHeader title={t("nav.batteries")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === f ? "bg-navy-800 text-white" : "bg-white text-navy-500 hover:bg-navy-50"}`}>
            {f === "ALL" ? t("common.all") : f}
          </button>
        ))}
      </div>

      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data?.batteries.length ? (
        <div className="card"><EmptyState /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.batteries.map((b) => (
            <Link key={b.id} href={`/owner/batteries/${b.id}`} className="card p-4 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between">
                <div className="text-lg font-bold text-navy-900">{b.code}</div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <HealthBar label={t("battery.soh")} value={b.soh} tone={b.soh >= 60 ? "healthy" : b.soh >= 40 ? "warn" : "critical"} />
                <HealthBar label={t("battery.soc")} value={b.soc} tone="info" />
              </div>
              <div className="mt-3 flex justify-between text-xs text-navy-400">
                <span>{b.cycleCount} {t("battery.cycles").toLowerCase()}</span>
                <span>{b.vehicles[0]?.code ?? b.hub?.name ?? "—"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthBar({ label, value, tone }: { label: string; value: number; tone: "healthy" | "warn" | "critical" | "info" }) {
  const color = tone === "healthy" ? "bg-healthy" : tone === "warn" ? "bg-warn" : tone === "critical" ? "bg-critical" : "bg-info";
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-navy-400">{label}</span><span className="font-semibold text-navy-700">{Math.round(value)}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
