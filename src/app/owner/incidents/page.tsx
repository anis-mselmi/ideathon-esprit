"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { IncidentCard, Incident } from "@/components/IncidentCard";

export default function IncidentsPage() {
  const { t } = useI18n();
  const [showResolved, setShowResolved] = useState(false);
  const status = showResolved ? "ALL" : "OPEN,ACKNOWLEDGED";
  const { data, loading, error, refetch } = useApi<{ incidents: Incident[] }>(`/api/incidents?status=${status}`, [status]);
  useRealtime((e) => (e.type === "incident" || e.type === "risk") && refetch());

  return (
    <div>
      <PageHeader
        title={t("incidents.title")}
        action={
          <button className="btn-ghost text-sm" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? t("incidents.open") : t("common.all")}
          </button>
        }
      />
      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> :
        !data?.incidents.length ? (
          <div className="card"><EmptyState title={t("cc.allClear")} icon="✅" /></div>
        ) : (
          <div className="space-y-3">
            {data.incidents.map((i) => <IncidentCard key={i.id} incident={i} onChange={refetch} />)}
          </div>
        )}
    </div>
  );
}
