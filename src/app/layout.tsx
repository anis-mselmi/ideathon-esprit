import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Locale, RTL_LOCALES } from "@/lib/i18n/dictionaries";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "EVA",
  description: "Smart electric mobility management for safer micro-leasing.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1f2c49",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = (jar.get("eva_locale")?.value as Locale) || "en";
  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body>
        <I18nProvider initialLocale={locale}>
          <ToastProvider>{children}</ToastProvider>
          <ServiceWorker />
        </I18nProvider>
      </body>
    </html>
  );
}
