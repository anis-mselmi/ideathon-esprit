"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { BookingModal } from "@/components/BookingModal";

interface Vehicle { id: string; code: string; model: string; rangeKm: number; pricePerHour: number; battery: { soc: number } | null; }

export default function BrowsePage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<{ vehicles: Vehicle[] }>("/api/vehicles");
  const [booking, setBooking] = useState<Vehicle | null>(null);

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-black sm:text-3xl">{t("browse.title")}</h1>
        <p className="mt-2 max-w-md text-navy-100">{t("browse.subtitle")}</p>
      </div>

      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> :
        !data?.vehicles.length ? <div className="card"><EmptyState /></div> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.vehicles.map((v) => (
              <div key={v.id} className="card overflow-hidden">
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-navy-100 to-navy-50 text-5xl">🛵</div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-navy-900">{v.model}</div>
                      <div className="text-xs text-navy-400">{v.code}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs text-navy-400">{t("browse.from")}</div>
                      <div className="font-bold text-navy-900">{v.pricePerHour} DT{t("common.perHour")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-navy-500">
                    <span>⚡ {v.rangeKm} km</span>
                    {v.battery && <span>🔋 {Math.round(v.battery.soc)}%</span>}
                    <span className="ms-auto rounded-full bg-healthy/10 px-2 py-0.5 font-semibold text-healthy">{t("common.available")}</span>
                  </div>
                  <button className="btn-primary mt-4 w-full" onClick={() => setBooking(v)}>{t("browse.book")}</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {booking && (
        <BookingModal
          vehicle={booking}
          onClose={() => setBooking(null)}
          onBooked={() => { setBooking(null); refetch(); }}
        />
      )}
    </div>
  );
}
