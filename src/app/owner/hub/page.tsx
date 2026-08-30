"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, useApi } from "@/lib/client";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, StatusBadge, LoadingState, ErrorState } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Battery { id: string; code: string; soh: number; soc: number; status: string; voltageClass: number; vehicles: { code: string }[]; }
interface Vehicle { id: string; code: string; voltageClass: number; status: string; battery: { code: string; soh: number; status: string } | null; }

export default function HubPage() {
  const { t } = useI18n();
  const { push } = useToast();
  const bats = useApi<{ batteries: Battery[] }>("/api/batteries");
  const vehs = useApi<{ vehicles: Vehicle[] }>("/api/vehicles");
  const [swapVehicle, setSwapVehicle] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const b = bats.data?.batteries ?? [];
    return {
      total: b.length,
      ready: b.filter((x) => x.status === "READY").length,
      charging: b.filter((x) => x.status === "CHARGING").length,
      assigned: b.filter((x) => x.status === "ASSIGNED").length,
      attention: b.filter((x) => x.status === "ATTENTION").length,
      service: b.filter((x) => x.status === "SERVICE").length,
    };
  }, [bats.data]);

  // Recommend the healthiest compatible READY battery for a vehicle.
  const recommend = (v: Vehicle): Battery | null => {
    const candidates = (bats.data?.batteries ?? [])
      .filter((b) => b.status === "READY" && b.voltageClass === v.voltageClass && b.soh >= 60)
      .sort((a, b) => b.soh - a.soh || b.soc - a.soc);
    return candidates[0] ?? null;
  };

  async function doSwap(v: Vehicle, b: Battery) {
    setBusy(true);
    try {
      await api("/api/hubs/swap", { method: "POST", body: JSON.stringify({ vehicleId: v.id, newBatteryId: b.id }) });
      push(`${v.code}: ${b.code} assigned. Ready.`, "success");
      setSwapVehicle(null);
      bats.refetch();
      vehs.refetch();
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if ((bats.loading && !bats.data) || (vehs.loading && !vehs.data)) return <LoadingState />;
  if (bats.error) return <ErrorState message={bats.error} onRetry={bats.refetch} />;

  const rec = swapVehicle ? recommend(swapVehicle) : null;

  return (
    <div>
      <PageHeader title={t("hub.title")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("common.total")} value={summary.total} />
        <StatCard label={t("hub.ready")} value={summary.ready} tone="healthy" />
        <StatCard label={t("hub.charging")} value={summary.charging} tone="info" />
        <StatCard label={t("hub.assigned")} value={summary.assigned} tone="info" />
        <StatCard label={t("hub.attention")} value={summary.attention} tone="warn" />
        <StatCard label={t("hub.service")} value={summary.service} tone="critical" />
      </div>

      {/* Vehicles needing a swap surfaced first */}
      <h2 className="mb-3 mt-6 text-lg font-bold text-navy-900">{t("hub.swap")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(vehs.data?.vehicles ?? [])
          .slice()
          .sort((a, b) => (needsSwap(b) ? 1 : 0) - (needsSwap(a) ? 1 : 0))
          .map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-navy-900">{v.code}</div>
                <StatusBadge status={v.status} />
              </div>
              <div className="mt-2 text-sm text-navy-500">
                {t("battery.currentVehicle") /* reuse */}: {v.battery?.code ?? "—"}
                {v.battery && <span className="ms-1 font-semibold">({Math.round(v.battery.soh)}% {t("common.health").toLowerCase()})</span>}
              </div>
              {needsSwap(v) && (
                <div className="mt-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs font-medium text-warn">
                  {t("battery.serviceRequired")}
                </div>
              )}
              <button className="btn-ghost mt-3 w-full text-sm" onClick={() => setSwapVehicle(v)}>{t("hub.swap")}</button>
            </div>
          ))}
      </div>

      <Modal open={!!swapVehicle} onClose={() => setSwapVehicle(null)} title={`${t("hub.swap")} · ${swapVehicle?.code}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setSwapVehicle(null)}>{t("common.cancel")}</button>
            {rec && swapVehicle && (
              <button className="btn-primary" disabled={busy} onClick={() => doSwap(swapVehicle, rec)}>
                {t("hub.assign")} {rec.code}
              </button>
            )}
          </>
        }>
        {swapVehicle && (
          <div className="space-y-3">
            <div className="rounded-xl bg-navy-50 p-3 text-sm">
              <div className="text-navy-400">Current battery</div>
              <div className="font-semibold text-navy-800">{swapVehicle.battery?.code ?? "—"} {swapVehicle.battery ? `· ${Math.round(swapVehicle.battery.soh)}%` : ""}</div>
            </div>
            {rec ? (
              <div className="rounded-xl border border-healthy/30 bg-healthy/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-healthy">{t("hub.recommends")}</div>
                <div className="mt-1 text-lg font-bold text-navy-900">{rec.code}</div>
                <div className="mt-2 space-y-1 text-sm text-navy-700">
                  <div>✓ {t("hub.compatible")} ({rec.voltageClass}V)</div>
                  <div>✓ {t("hub.healthy")} · SOH {Math.round(rec.soh)}%</div>
                  <div>✓ {t("hub.socSufficient")} · SOC {Math.round(rec.soc)}%</div>
                </div>
                <div className="mt-3 rounded-lg bg-healthy px-3 py-1.5 text-center text-sm font-semibold text-white">{t("hub.safeToDeploy")}</div>
              </div>
            ) : (
              <div className="rounded-xl bg-warn/10 p-4 text-sm text-warn">No compatible healthy battery available in the hub.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function needsSwap(v: Vehicle): boolean {
  return !!v.battery && (v.battery.soh < 60 || v.status === "AT_RISK" || v.status === "MAINTENANCE");
}
