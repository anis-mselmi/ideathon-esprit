"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, useApi } from "@/lib/client";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/ui";

interface SimStatus {
  running: boolean; intervalMs: number;
  vehicles: { vehicleCode: string; scenario: string; offline: boolean; soc: number; temperature: number }[];
}

const SCENARIOS: { key: string; label: string; icon: string }[] = [
  { key: "OVERHEATING", label: "Battery overheating", icon: "🔥" },
  { key: "VOLTAGE_ANOMALY", label: "Voltage drop", icon: "⚡" },
  { key: "BATTERY_DEGRADATION", label: "Battery degradation", icon: "📉" },
  { key: "LOW_BATTERY", label: "Low battery", icon: "🪫" },
  { key: "SUSPICIOUS_MOVEMENT", label: "Suspicious movement", icon: "🧭" },
  { key: "THEFT_RISK", label: "Theft scenario", icon: "🚨" },
  { key: "GPS_LOSS", label: "GPS loss", icon: "🛰️" },
  { key: "BLE_LOSS", label: "BLE loss", icon: "📶" },
  { key: "TAMPERING", label: "Tampering", icon: "🔧" },
  { key: "NORMAL", label: "Reset to normal", icon: "✅" },
];

export default function DemoPanel() {
  const { t } = useI18n();
  const { push } = useToast();
  const { data, loading, refetch } = useApi<SimStatus>("/api/sim");
  const [vehicle, setVehicle] = useState("EV-014");
  const [busy, setBusy] = useState(false);

  async function control(body: object, msg?: string) {
    setBusy(true);
    try {
      await api("/api/sim", { method: "POST", body: JSON.stringify(body) });
      if (msg) push(msg, "success");
      refetch();
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function fullDemo() {
    setBusy(true);
    try {
      const res = await api<{ openIncidents: number }>("/api/sim/full-demo", { method: "POST" });
      push(`Full demo running — ${res.openIncidents} incidents. Open the Command Center.`, "success");
      refetch();
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingState />;

  return (
    <div>
      <PageHeader title={t("demo.title")} subtitle={t("demo.subtitle")} />

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${data?.running ? "bg-healthy/10 text-healthy" : "bg-navy-100 text-navy-500"}`}>
            <span className={`h-2 w-2 rounded-full ${data?.running ? "bg-healthy animate-pulse" : "bg-navy-400"}`} />
            {data?.running ? t("demo.running") : t("demo.stopped")}
          </span>
          {!data?.running ? (
            <button className="btn-primary" disabled={busy} onClick={() => control({ action: "start" }, "Simulation started")}>▶ {t("demo.start")}</button>
          ) : (
            <button className="btn-ghost" disabled={busy} onClick={() => control({ action: "stop" }, "Simulation stopped")}>⏸ {t("demo.stop")}</button>
          )}
          <button className="btn-ghost" disabled={busy} onClick={() => control({ action: "step" })}>⏭ {t("demo.step")}</button>
          <button className="btn-danger ms-auto" disabled={busy} onClick={fullDemo}>🎬 {t("demo.runFullDemo")}</button>
        </div>
      </div>

      <div className="mt-4 card p-4">
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium text-navy-600" htmlFor="vsel">{t("demo.selectVehicle")}</label>
          <select id="vsel" className="input max-w-[160px]" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            {data?.vehicles.map((v) => <option key={v.vehicleCode} value={v.vehicleCode}>{v.vehicleCode}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SCENARIOS.map((s) => (
            <button key={s.key} disabled={busy}
              onClick={() => control({ action: "trigger", scenario: s.key, vehicleCode: vehicle }, `${s.label} → ${vehicle}`)}
              className="flex flex-col items-center gap-1 rounded-xl border border-navy-100 bg-white px-3 py-3 text-center text-xs font-medium text-navy-700 hover:border-navy-300 hover:bg-navy-50">
              <span className="text-xl">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live simulator state */}
      <div className="mt-4 card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-4 py-2 text-start">Vehicle</th>
              <th className="px-4 py-2 text-start">Scenario</th>
              <th className="px-4 py-2 text-end">SOC</th>
              <th className="px-4 py-2 text-end">Temp</th>
              <th className="px-4 py-2 text-end">Link</th>
            </tr>
          </thead>
          <tbody>
            {data?.vehicles.map((v) => (
              <tr key={v.vehicleCode} className="border-b border-navy-50 last:border-0">
                <td className="px-4 py-2 font-semibold text-navy-900">{v.vehicleCode}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.scenario === "NORMAL" ? "bg-navy-100 text-navy-500" : "bg-warn/10 text-warn"}`}>{v.scenario}</span>
                </td>
                <td className="px-4 py-2 text-end tabular-nums">{v.soc}%</td>
                <td className={`px-4 py-2 text-end tabular-nums ${v.temperature > 48 ? "text-critical font-semibold" : ""}`}>{v.temperature}°C</td>
                <td className="px-4 py-2 text-end">{v.offline ? "🔌 offline" : "🟢"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
