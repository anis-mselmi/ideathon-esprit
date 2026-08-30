"use client";

import { use } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, StatCard, LoadingState, ErrorState, RiskScore } from "@/components/ui";
import { TelemetryChart } from "@/components/TelemetryChart";

interface Passport {
  battery: {
    id: string; code: string; status: string; soh: number; soc: number; cycleCount: number; ageMonths: number; voltageClass: number;
    hub: { name: string } | null;
    vehicles: { code: string }[];
    readings: { timestamp: string; temperature: number; voltage: number; soc: number }[];
    assignments: { assignedAt: string; removedAt: string | null; vehicle: { code: string } }[];
    maintenance: { kind: string; note: string; createdAt: string }[];
  };
  soh: { score: number; label: string; explanation: string[]; recommended_action: string; technical: any };
  rul: { cyclesLow: number; cyclesHigh: number; confidence: number };
}

export default function BatteryPassport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<Passport>(`/api/batteries/${id}`);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;
  const b = data.battery;
  const fmt = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const rd = [...b.readings].reverse();
  const series = (key: "temperature" | "voltage" | "soc") => rd.map((r) => ({ t: fmt(r.timestamp), value: Math.round(r[key] * 10) / 10 }));
  const last = rd[rd.length - 1];

  return (
    <div>
      <Link href="/owner/batteries" className="mb-3 inline-block text-sm text-navy-500 hover:text-navy-800">← {t("nav.batteries")}</Link>
      <PageHeader title={`${t("battery.passport")} · ${b.code}`} action={<StatusBadge status={b.status} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* SOH + interpretation */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center gap-4">
            <RiskScore score={b.soh} size={80} />
            <div>
              <div className="text-xs uppercase tracking-wide text-navy-400">{t("battery.soh")}</div>
              <div className="text-2xl font-bold text-navy-900">{Math.round(b.soh)}%</div>
              <div className="text-sm font-semibold text-navy-600">{data.soh.label}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-navy-600">{data.soh.explanation.join(" ")}</p>
          <div className="mt-3 rounded-xl bg-navy-50 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-navy-400">{t("common.recommendedAction")}</div>
            <div className="mt-0.5 font-medium text-navy-800">{data.soh.recommended_action}</div>
          </div>
          <div className="mt-3 rounded-xl border border-navy-100 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-navy-400">Remaining useful life</div>
            <div className="mt-0.5 font-medium text-navy-800">~{data.rul.cyclesLow}–{data.rul.cyclesHigh} cycles</div>
            <div className="text-xs text-navy-400">{t("common.confidence")} {Math.round(data.rul.confidence * 100)}%</div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("battery.soc")} value={`${Math.round(b.soc)}%`} tone="info" />
            <StatCard label={t("battery.cycles")} value={b.cycleCount} />
            <StatCard label={t("battery.age")} value={`${b.ageMonths} ${t("battery.months")}`} />
            <StatCard label={t("common.temperature")} value={last ? `${Math.round(last.temperature)}°C` : "—"} tone={last && last.temperature > 48 ? "critical" : "default"} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="card p-3"><div className="mb-1 text-xs font-semibold text-navy-600">{t("common.temperature")}</div><TelemetryChart data={series("temperature")} color="#dc2626" unit="°C" /></div>
            <div className="card p-3"><div className="mb-1 text-xs font-semibold text-navy-600">{t("common.voltage")}</div><TelemetryChart data={series("voltage")} color="#2563eb" unit="V" /></div>
            <div className="card p-3"><div className="mb-1 text-xs font-semibold text-navy-600">{t("battery.soc")}</div><TelemetryChart data={series("soc")} color="#16a34a" unit="%" /></div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-bold text-navy-900">{t("fleet.assignBattery")} — {t("battery.history")}</h2>
          <div className="card divide-y divide-navy-100">
            {b.assignments.length === 0 ? <div className="px-4 py-4 text-sm text-navy-400">{t("common.empty")}</div> :
              b.assignments.map((a, i) => (
                <div key={i} className="flex justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-navy-800">{a.vehicle.code}</span>
                  <span className="text-xs text-navy-400">{new Date(a.assignedAt).toLocaleDateString()} {a.removedAt ? `→ ${new Date(a.removedAt).toLocaleDateString()}` : "· current"}</span>
                </div>
              ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-bold text-navy-900">{t("battery.history")}</h2>
          <div className="card divide-y divide-navy-100">
            {b.maintenance.length === 0 ? <div className="px-4 py-4 text-sm text-navy-400">{t("common.empty")}</div> :
              b.maintenance.map((m, i) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="font-medium text-navy-800">{m.kind}</div>
                  <div className="text-xs text-navy-400">{m.note} · {new Date(m.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
