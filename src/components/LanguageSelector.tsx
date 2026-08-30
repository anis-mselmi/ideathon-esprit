"use client";

import { useI18n } from "@/lib/i18n";
import { LOCALES, localeNames, Locale } from "@/lib/i18n/dictionaries";

export function LanguageSelector({ compact }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Language</span>
      <span aria-hidden className="text-navy-400">🌐</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={`rounded-lg border border-navy-200 bg-white py-1.5 text-sm text-navy-700 focus:border-navy-500 focus:outline-none ${
          compact ? "px-2" : "px-3"
        }`}
        aria-label="Select language"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
