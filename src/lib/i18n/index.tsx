"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { dictionaries, en, Locale, RTL_LOCALES } from "./dictionaries";

interface I18nCtx {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `eva_locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    document.documentElement.lang = l;
    document.documentElement.dir = RTL_LOCALES.includes(l) ? "rtl" : "ltr";
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] ?? en;
      let s = dict[key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [locale]
  );

  const value = useMemo<I18nCtx>(
    () => ({ locale, dir: RTL_LOCALES.includes(locale) ? "rtl" : "ltr", t, setLocale }),
    [locale, t, setLocale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
