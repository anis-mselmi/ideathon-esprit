"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { LanguageSelector } from "./LanguageSelector";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"OWNER" | "CLIENT">("CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, fullName, role };
      const res = await api<{ role: string }>(path, { method: "POST", body: JSON.stringify(body) });
      router.push(res.role === "OWNER" ? "/owner" : "/client");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-navy-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-white">⚡</span>
            {t("app.name")}
          </Link>
          <LanguageSelector compact />
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-navy-900">
            {mode === "login" ? t("auth.welcome") : t("auth.createTitle")}
          </h1>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "register" && (
              <div>
                <label className="label" htmlFor="fullName">{t("auth.fullName")}</label>
                <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">{t("auth.email")}</label>
              <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("auth.password")}</label>
              <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {mode === "register" && (
              <div>
                <span className="label">{t("auth.role")}</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["CLIENT", "OWNER"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                        role === r ? "border-navy-800 bg-navy-50 text-navy-900" : "border-navy-200 text-navy-500"
                      }`}
                    >
                      {r === "OWNER" ? t("auth.owner") : t("auth.client")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</div>}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? t("common.loading") : mode === "login" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-navy-500">
            {mode === "login" ? (
              <>
                {t("auth.noAccount")}{" "}
                <Link href="/register" className="font-semibold text-navy-800 underline underline-offset-2">
                  {t("auth.signUp")}
                </Link>
              </>
            ) : (
              <>
                {t("auth.haveAccount")}{" "}
                <Link href="/login" className="font-semibold text-navy-800 underline underline-offset-2">
                  {t("auth.signIn")}
                </Link>
              </>
            )}
          </div>
        </div>

        
      </div>
    </div>
  );
}
