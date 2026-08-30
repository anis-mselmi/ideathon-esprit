"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { useToast } from "./Toast";
import { Modal } from "./Modal";

interface Vehicle { id: string; code: string; model: string; pricePerHour: number; }

function defaultDate() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function defaultTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function BookingModal({ vehicle, onClose, onBooked }: { vehicle: Vehicle; onClose: () => void; onBooked: () => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState(defaultTime());
  const [hours, setHours] = useState(2);
  const [idType, setIdType] = useState<"CIN" | "PASSPORT">("CIN");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [payment, setPayment] = useState<"ONLINE" | "PAY_AT_SHOP">("PAY_AT_SHOP");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const total = useMemo(() => Math.round(vehicle.pricePerHour * hours * 100) / 100, [vehicle.pricePerHour, hours]);
  const steps = [t("book.step.datetime"), t("book.step.details"), t("book.step.payment"), t("book.step.confirm")];

  async function confirm() {
    setBusy(true);
    try {
      const startTime = new Date(`${date}T${time}:00`).toISOString();
      await api("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ vehicleId: vehicle.id, startTime, hours, paymentMethod: payment, idType, idNumber, dateOfBirth: dob || undefined }),
      });
      setDone(true);
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={() => { onBooked(); }} title={t("book.confirmed")}
        footer={<button className="btn-primary" onClick={onBooked}>{t("common.close")}</button>}>
        <div className="py-4 text-center">
          <div className="text-5xl">✅</div>
          <p className="mt-3 text-navy-600">{t("book.confirmedBody")}</p>
          <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm">
            <div className="font-semibold text-navy-900">{vehicle.model} · {vehicle.code}</div>
            <div className="text-navy-500">{date} {time} · {hours} {t("common.hours")} · {total} DT</div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`${t("book.title")} · ${vehicle.model}`}
      footer={
        <>
          {step > 0 && <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}>←</button>}
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !idNumber}>
              {t("common.confirm")} →
            </button>
          ) : (
            <button className="btn-primary" onClick={confirm} disabled={busy}>{t("book.confirmReservation")}</button>
          )}
        </>
      }>
      {/* Step indicator */}
      <div className="mb-4 flex gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-navy-800" : "bg-navy-100"}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label">{t("book.date")}</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("book.startTime")}</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("book.duration")}: {hours} {hours === 1 ? t("common.hour") : t("common.hours")}</label>
            <input type="range" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-navy-800" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <span className="label">{t("book.idType")}</span>
            <div className="grid grid-cols-2 gap-2">
              {(["CIN", "PASSPORT"] as const).map((x) => (
                <button key={x} type="button" onClick={() => setIdType(x)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${idType === x ? "border-navy-800 bg-navy-50 text-navy-900" : "border-navy-200 text-navy-500"}`}>
                  {x === "CIN" ? t("book.cin") : t("book.passport")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t("book.idNumber")}</label>
            <input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder={idType === "CIN" ? "8 digits" : "Passport no."} />
          </div>
          <div>
            <label className="label">{t("book.dob")}</label>
            <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <p className="text-xs text-navy-400">🔒 Your ID is stored securely and shown only to the operator for rental verification.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {(["PAY_AT_SHOP", "ONLINE"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setPayment(m)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start ${payment === m ? "border-navy-800 bg-navy-50" : "border-navy-200"}`}>
              <span className="font-medium text-navy-800">{m === "ONLINE" ? t("book.payOnline") : t("book.payShop")}</span>
              <span className={`h-4 w-4 rounded-full border-2 ${payment === m ? "border-navy-800 bg-navy-800" : "border-navy-300"}`} />
            </button>
          ))}
          {payment === "ONLINE" && <p className="text-xs text-navy-400">Mock payment for the prototype — no card details are collected or stored.</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <Row label={t("book.step.vehicle")} value={`${vehicle.model} · ${vehicle.code}`} />
          <Row label={t("book.date")} value={`${date} ${time}`} />
          <Row label={t("book.duration")} value={`${hours} ${t("common.hours")}`} />
          <Row label={t("book.step.payment")} value={payment === "ONLINE" ? t("book.payOnline") : t("book.payShop")} />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-navy-800 px-4 py-3 text-white">
            <span className="text-sm">{t("book.total")}</span>
            <span className="text-lg font-bold">{total} DT</span>
          </div>
          <p className="text-xs text-navy-400">{vehicle.pricePerHour} DT{t("common.perHour")} × {hours} {t("common.hours")}</p>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-navy-400">{label}</span>
      <span className="font-medium text-navy-800">{value}</span>
    </div>
  );
}
