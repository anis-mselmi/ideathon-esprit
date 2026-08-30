"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "./LanguageSelector";

export function Landing() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-950 to-navy-800 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-lg">⚡</span>
          {t("app.name")}
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector compact />
          <Link href="/login" className="btn bg-white/10 text-white hover:bg-white/20">
            {t("auth.signIn")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              {t("app.name")}
            </h1>
            <p className="mt-4 max-w-md text-lg text-navy-100">{t("app.tagline")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn bg-white text-navy-900 hover:bg-navy-50">
                {t("auth.signUp")} →
              </Link>
              <Link href="/login" className="btn bg-white/10 text-white hover:bg-white/20">
                {t("auth.signIn")}
              </Link>
            </div>
            <div className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-navy-100">
              <div className="font-semibold text-white">{t("auth.demoAccounts")}</div>
              <div className="mt-1 font-mono text-xs">owner@eva.tn / owner123</div>
              <div className="font-mono text-xs">client@eva.tn / client123</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "🔋", k: "Battery AI", d: "Anomaly, health & fault detection" },
              { icon: "🛰️", k: "Live tracking", d: "GPS + BLE with confidence" },
              { icon: "🚨", k: "Theft & tampering", d: "Behavioural risk scoring" },
              { icon: "📅", k: "Rentals", d: "Booking, modify, cancel, expiry" },
            ].map((f) => (
              <div key={f.k} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                <div className="text-2xl">{f.icon}</div>
                <div className="mt-3 font-semibold">{f.k}</div>
                <div className="mt-1 text-sm text-navy-100">{f.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 py-10 text-center text-sm text-navy-200">
          Sense → Understand → Act · {t("app.name")}
        </section>
      </main>
    </div>
  );
}
