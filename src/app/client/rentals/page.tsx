"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, useApi } from "@/lib/client";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Reservation {
  id: string; status: string; startTime: string; endTime: string; hours: number; priceTotal: number;
  vehicle: { code: string; model: string; pricePerHour: number };
}
interface Rental { id: string; status: string; startTime: string; endTime: string; priceTotal: number; vehicle: { code: string; model: string }; }

export default function MyRentals() {
  const { t } = useI18n();
  const { push } = useToast();
  const res = useApi<{ reservations: Reservation[] }>("/api/reservations");
  const ren = useApi<{ rentals: Rental[] }>("/api/rentals");
  const [modify, setModify] = useState<Reservation | null>(null);

  const fmt = (ts: string) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  async function cancel(id: string) {
    try {
      await api(`/api/reservations/${id}/cancel`, { method: "POST" });
      push("Reservation cancelled.", "success");
      res.refetch();
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  if ((res.loading && !res.data) || (ren.loading && !ren.data)) return <LoadingState />;
  if (res.error) return <ErrorState message={res.error} onRetry={res.refetch} />;

  const upcoming = (res.data?.reservations ?? []).filter((r) => r.status === "UPCOMING");
  const cancelled = (res.data?.reservations ?? []).filter((r) => r.status === "CANCELLED");
  const active = (ren.data?.rentals ?? []).filter((r) => ["ACTIVE", "ENDING_SOON", "EXPIRED", "OVERDUE"].includes(r.status));
  const past = (ren.data?.rentals ?? []).filter((r) => ["RETURNED", "CANCELLED"].includes(r.status));

  return (
    <div>
      <PageHeader title={t("rentals.title")} />

      {active.length > 0 && (
        <Section title={t("rentals.active")}>
          {active.map((r) => (
            <div key={r.id} className="card p-4">
              <Head code={r.vehicle.code} model={r.vehicle.model} status={r.status} />
              <div className="mt-2 text-sm text-navy-500">{fmt(r.startTime)} → {fmt(r.endTime)}</div>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("rentals.upcoming")}>
        {upcoming.length === 0 ? <EmptyState /> : upcoming.map((r) => (
          <div key={r.id} className="card p-4">
            <Head code={r.vehicle.code} model={r.vehicle.model} status={r.status} />
            <div className="mt-2 text-sm text-navy-500">{fmt(r.startTime)} · {r.hours} {t("common.hours")} · {r.priceTotal} DT</div>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost text-xs" onClick={() => setModify(r)}>{t("rentals.modify")}</button>
              <button className="btn-danger text-xs" onClick={() => cancel(r.id)}>{t("rentals.cancel")}</button>
            </div>
          </div>
        ))}
      </Section>

      {past.length > 0 && (
        <Section title={t("rentals.past")}>
          {past.map((r) => (
            <div key={r.id} className="card p-4 opacity-80">
              <Head code={r.vehicle.code} model={r.vehicle.model} status={r.status} />
              <div className="mt-2 text-sm text-navy-500">{fmt(r.startTime)} → {fmt(r.endTime)}</div>
            </div>
          ))}
        </Section>
      )}

      {cancelled.length > 0 && (
        <Section title={t("rentals.cancelled")}>
          {cancelled.map((r) => (
            <div key={r.id} className="card p-4 opacity-70">
              <Head code={r.vehicle.code} model={r.vehicle.model} status="CANCELLED" />
            </div>
          ))}
        </Section>
      )}

      {modify && <ModifyModal reservation={modify} onClose={() => setModify(null)} onDone={() => { setModify(null); res.refetch(); }} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold text-navy-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Head({ code, model, status }: { code: string; model: string; status: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="font-bold text-navy-900">{model}</div>
        <div className="text-xs text-navy-400">{code}</div>
      </div>
      <StatusBadge status={status} label={t(`rentalStatus.${status}`)} />
    </div>
  );
}

function ModifyModal({ reservation, onClose, onDone }: { reservation: Reservation; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const start = new Date(reservation.startTime);
  const [date, setDate] = useState(start.toISOString().slice(0, 10));
  const [time, setTime] = useState(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
  const [hours, setHours] = useState(reservation.hours);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const startTime = new Date(`${date}T${time}:00`).toISOString();
      await api(`/api/reservations/${reservation.id}`, { method: "PATCH", body: JSON.stringify({ startTime, hours }) });
      push("Booking updated.", "success");
      onDone();
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t("rentals.modify")} · ${reservation.vehicle.code}`}
      footer={<><button className="btn-ghost" onClick={onClose}>{t("common.cancel")}</button><button className="btn-primary" disabled={busy} onClick={save}>{t("common.save")}</button></>}>
      <div className="space-y-4">
        <div><label className="label">{t("book.date")}</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">{t("book.startTime")}</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label className="label">{t("book.duration")}: {hours} {t("common.hours")}</label><input type="range" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-navy-800" /></div>
        <div className="rounded-xl bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-800">{t("book.total")}: {reservation.vehicle.pricePerHour * hours} DT</div>
      </div>
    </Modal>
  );
}
