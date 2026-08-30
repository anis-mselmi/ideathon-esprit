"use client";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, LoadingState, ErrorState, EmptyState, StatusBadge } from "@/components/ui";
import { IncidentCard, Incident } from "@/components/IncidentCard";

interface CommandCenter {
  overview: { total: number; available: number; rented: number; maintenance: number; atRisk: number; offline: number };
  incidents: Incident[];
  activeRentals: {
    id: string; status: string; endTime: string;
    vehicle: { code: string; model: string }; user: { fullName: string };
  }[];
  aiOnline: boolean;
}

export default function CommandCenterPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<CommandCenter>("/api/command-center");

  useRealtime((e) => {
    if (e.type === "incident" || e.type === "vehicle-status" || e.type === "risk") refetch();
  });

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { overview, incidents, activeRentals } = data;

  return (
    <div>
      <PageHeader title={t("cc.title")} subtitle={t("cc.subtitle")} />

      {!data.aiOnline && (
        <div className="mb-4 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">{t("cc.aiUnavailable")}</div>
      )}

      {/* Fleet overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("common.total")} value={overview.total} />
        <StatCard label={t("common.available")} value={overview.available} tone="healthy" />
        <StatCard label={t("common.rented")} value={overview.rented} tone="info" />
        <StatCard label={t("common.maintenance")} value={overview.maintenance} tone="warn" />
        <StatCard label={t("common.atRisk")} value={overview.atRisk} tone="critical" />
        <StatCard label={t("common.offline")} value={overview.offline} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Incident priority list — the primary focus */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-navy-900">
            {t("cc.needsAttention")}
            {incidents.length > 0 && (
              <span className="rounded-full bg-critical px-2 py-0.5 text-xs font-bold text-white">{incidents.length}</span>
            )}
          </h2>
          {incidents.length === 0 ? (
            <div className="card"><EmptyState title={t("cc.allClear")} icon="✅" /></div>
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => (
                <IncidentCard key={i.id} incident={i} onChange={refetch} />
              ))}
            </div>
          )}
        </section>

        {/* Active rentals */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-navy-900">{t("cc.activeRentals")}</h2>
          <div className="card divide-y divide-navy-100">
            {activeRentals.length === 0 ? (
              <EmptyState icon="📅" />
            ) : (
              activeRentals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900">{r.vehicle.code}</div>
                    <div className="truncate text-xs text-navy-400">{r.user.fullName}</div>
                  </div>
                  <div className="text-end">
                    <StatusBadge status={r.status} label={t(`rentalStatus.${r.status}`)} />
                    <div className="mt-1 text-[11px] text-navy-400">
                      {new Date(r.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
