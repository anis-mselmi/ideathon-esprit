"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { SeverityBadge, RiskScore } from "./ui";
import { api } from "@/lib/client";
import { useToast } from "./Toast";

export interface Incident {
  id: string;
  type: string;
  severity: string;
  riskScore: number;
  confidence: number;
  title: string;
  explanation: string;
  technical?: string | null;
  action: string;
  status: string;
  vehicle?: { code: string } | null;
}

export function IncidentCard({ incident, onChange }: { incident: Incident; onChange?: () => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [showWhy, setShowWhy] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api(`/api/incidents/${incident.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      push(status === "RESOLVED" ? "Incident resolved." : "Incident acknowledged.", "success");
      onChange?.();
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  let tech: Record<string, number> | null = null;
  try {
    tech = incident.technical ? JSON.parse(incident.technical) : null;
  } catch {
    tech = null;
  }

  return (
    <div className="card p-4 sm:p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <RiskScore score={incident.riskScore} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {incident.vehicle && (
              <span className="rounded-md bg-navy-800 px-2 py-0.5 text-xs font-bold text-white">
                {incident.vehicle.code}
              </span>
            )}
            <SeverityBadge severity={incident.severity} />
            <span className="text-xs text-navy-400">
              {t("common.confidence")} {Math.round(incident.confidence * 100)}%
            </span>
          </div>

          {/* INTERPRETATION, not raw data */}
          <h3 className="mt-2 text-base font-bold text-navy-900">{incident.title}</h3>
          <p className="mt-1 text-sm text-navy-600">{incident.explanation}</p>

          {/* ACTION */}
          <div className="mt-3 rounded-xl bg-navy-50 px-3 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-navy-400">
              {t("common.recommendedAction")}
            </div>
            <div className="mt-0.5 text-sm font-medium text-navy-800">{incident.action}</div>
          </div>

          {/* Actions row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {incident.status === "OPEN" && (
              <button className="btn-ghost text-xs" disabled={busy} onClick={() => setStatus("ACKNOWLEDGED")}>
                {t("incidents.acknowledge")}
              </button>
            )}
            <button className="btn-primary text-xs" disabled={busy} onClick={() => setStatus("RESOLVED")}>
              {t("incidents.resolve")}
            </button>
            {tech && (
              <button
                className="text-xs font-medium text-navy-500 underline underline-offset-2 hover:text-navy-800"
                onClick={() => setShowWhy((v) => !v)}
              >
                {t("common.why")}
              </button>
            )}
          </div>

          {/* Technical "Why?" expansion */}
          {showWhy && tech && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-navy-100 p-3 text-xs sm:grid-cols-3">
              {Object.entries(tech).map(([k, v]) => (
                <div key={k}>
                  <div className="uppercase tracking-wide text-navy-400">{k}</div>
                  <div className="font-semibold tabular-nums text-navy-800">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
