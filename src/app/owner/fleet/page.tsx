"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/ui";

interface Vehicle {
  id: string; code: string; model: string; status: string; rangeKm: number; pricePerHour: number;
  battery: { code: string; soc: number; soh: number } | null;
}

const FILTERS = ["ALL", "AVAILABLE", "RENTED", "MAINTENANCE", "AT_RISK", "OFFLINE"];

export default function FleetPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("ALL");
  const { data, loading, error, refetch } = useApi<{ vehicles: Vehicle[] }>(
    `/api/vehicles${filter !== "ALL" ? `?status=${filter}` : ""}`,
    [filter]
  );
  useRealtime((e) => e.type === "vehicle-status" && refetch());

  return (
    <div>
      <PageHeader title={t("fleet.title")} />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? "bg-navy-800 text-white" : "bg-white text-navy-500 hover:bg-navy-50"
            }`}
          >
            {f === "ALL" ? t("common.all") : t(`common.${f.toLowerCase().replace("_", "")}` as string) || f}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.vehicles.length ? (
        <div className="card"><EmptyState /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.vehicles.map((v) => (
            <Link key={v.id} href={`/owner/fleet/${v.id}`} className="card p-4 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-navy-900">{v.code}</div>
                  <div className="text-sm text-navy-400">{v.model}</div>
                </div>
                <StatusBadge status={v.status} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="text-navy-500">
                  {t("fleet.range")} <span className="font-semibold text-navy-800">{v.rangeKm} km</span>
                </div>
                <div className="font-semibold text-navy-800">{v.pricePerHour} DT{t("common.perHour")}</div>
              </div>
              {v.battery && (
                <div className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-navy-400">{v.battery.code}</span>
                    <span className="font-semibold text-navy-700">SOC {Math.round(v.battery.soc)}% · SOH {Math.round(v.battery.soh)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-100">
                    <div className="h-full rounded-full bg-healthy" style={{ width: `${v.battery.soc}%` }} />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
