"use client";

import { use } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, StatCard, LoadingState, ErrorState, RiskScore } from "@/components/ui";
import { TelemetryChart } from "@/components/TelemetryChart";

interface Detail {
  vehicle: {
    id: string; code: string; model: string; status: string; rangeKm: number; pricePerHour: number;
    battery: { id: string; code: string; soc: number; soh: number } | null;
    telemetry: { timestamp: string; temperature: number | null; voltage: number | null; soc: number | null; bleSignal: number | null; bleConfidence: string | null; gpsAvailable: boolean }[];
    locations: { lat: number; lng: number; timestamp: string; gpsConfidence: number }[];
    riskScores: { overall: number; severity: string; batteryAnomaly: number; theftAnomaly: number; tamperAnomaly: number }[];
    rentals: { id: string; status: string; startTime: string; endTime: string; user: { fullName: string } }[];
  };
}

export default function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<Detail>(`/api/vehicles/${id}`);
  useRealtime((e) => (e.type === "telemetry" || e.type === "risk") && refetch());

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;
  const v = data.vehicle;
  const tel = v.telemetry;
  const fmt = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const risk = v.riskScores[0];
  const lastBle = [...tel].reverse().find((x) => x.bleSignal != null);

  const series = (key: "temperature" | "voltage" | "soc") =>
    tel.filter((x) => x[key] != null).map((x) => ({ t: fmt(x.timestamp), value: Math.round((x[key] as number) * 10) / 10 }));

  return (
    <div>
      <Link href="/owner/fleet" className="mb-3 inline-block text-sm text-navy-500 hover:text-navy-800">← {t("fleet.title")}</Link>
      <PageHeader
        title={v.code}
        subtitle={v.model}
        action={<StatusBadge status={v.status} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {risk && (
          <div className="card flex items-center gap-3 p-4">
            <RiskScore score={risk.overall} />
            <div>
              <div className="text-xs uppercase tracking-wide text-navy-400">{t("common.risk")}</div>
              <div className="text-sm font-semibold text-navy-800">{t(`sev.${risk.severity}`)}</div>
            </div>
          </div>
        )}
        {v.battery && <StatCard label={`${t("battery.soc")} · ${v.battery.code}`} value={`${Math.round(v.battery.soc)}%`} tone="info" />}
        {v.battery && <StatCard label={t("battery.soh")} value={`${Math.round(v.battery.soh)}%`} tone={v.battery.soh >= 60 ? "healthy" : "warn"} />}
        <StatCard
          label="BLE"
          value={lastBle?.bleSignal != null ? `${lastBle.bleSignal} dBm` : "—"}
          hint={lastBle?.bleConfidence ? `${t("common.confidence")}: ${lastBle.bleConfidence}` : undefined}
        />
      </div>

      {/* AI sub-scores */}
      {risk && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatCard label="Battery anomaly" value={`${Math.round(risk.batteryAnomaly)}`} />
          <StatCard label="Theft anomaly" value={`${Math.round(risk.theftAnomaly)}`} />
          <StatCard label="Tampering anomaly" value={`${Math.round(risk.tamperAnomaly)}`} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold text-navy-700">{t("common.temperature")} (°C)</div>
          <TelemetryChart data={series("temperature")} color="#dc2626" unit="°C" />
        </div>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold text-navy-700">{t("common.voltage")} (V)</div>
          <TelemetryChart data={series("voltage")} color="#2563eb" unit="V" />
        </div>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold text-navy-700">{t("battery.soc")} (%)</div>
          <TelemetryChart data={series("soc")} color="#16a34a" unit="%" />
        </div>
      </div>

      {/* Rental history */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-navy-900">{t("fleet.rentalHistory")}</h2>
        <div className="card divide-y divide-navy-100">
          {v.rentals.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-navy-400">{t("common.empty")}</div>
          ) : (
            v.rentals.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-navy-800">{r.user.fullName}</div>
                  <div className="text-xs text-navy-400">
                    {new Date(r.startTime).toLocaleDateString()} · {fmt(r.startTime)}–{fmt(r.endTime)}
                  </div>
                </div>
                <StatusBadge status={r.status} label={t(`rentalStatus.${r.status}`)} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
