"use client";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/ui";

interface Rental {
  id: string; status: string; startTime: string; endTime: string; priceTotal: number;
  vehicle: { code: string; model: string };
  user: { fullName: string; phone: string | null; idType: string | null; idNumber: string | null };
}

export default function OwnerRentals() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<{ rentals: Rental[] }>("/api/rentals");
  useRealtime((e) => e.type === "vehicle-status" && refetch());

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const fmt = (ts: string) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <PageHeader title={t("nav.rentals")} />
      {!data?.rentals.length ? (
        <div className="card"><EmptyState /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-start text-xs uppercase tracking-wide text-navy-400">
                <th className="px-4 py-3 text-start">Vehicle</th>
                <th className="px-4 py-3 text-start">Client</th>
                <th className="px-4 py-3 text-start">Identity</th>
                <th className="px-4 py-3 text-start">Window</th>
                <th className="px-4 py-3 text-start">{t("common.status")}</th>
                <th className="px-4 py-3 text-end">Price</th>
              </tr>
            </thead>
            <tbody>
              {data.rentals.map((r) => (
                <tr key={r.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-900">{r.vehicle.code}</td>
                  <td className="px-4 py-3">
                    <div className="text-navy-800">{r.user.fullName}</div>
                    <div className="text-xs text-navy-400">{r.user.phone}</div>
                  </td>
                  {/* Owner-only identity for rental verification */}
                  <td className="px-4 py-3 text-xs text-navy-500">
                    {r.user.idType ? `${r.user.idType} ····${r.user.idNumber?.slice(-4) ?? ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-500">{fmt(r.startTime)} → {fmt(r.endTime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} label={t(`rentalStatus.${r.status}`)} /></td>
                  <td className="px-4 py-3 text-end font-semibold">{r.priceTotal} DT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
