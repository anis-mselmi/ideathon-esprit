"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "./Toast";
import { LanguageSelector } from "./LanguageSelector";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
}

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavItem[];
  user: { fullName: string; role: string };
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);

  const notif = useApi<{ unread: number }>("/api/notifications");

  // Live: toast on incoming events + bump the unread badge.
  useRealtime((e) => {
    if (e.type === "notification") {
      notif.refetch();
      push(e.data?.title ?? "New notification", e.data?.severity === "CRITICAL" ? "error" : "info");
    } else if (e.type === "incident" && !e.data?.demo) {
      notif.refetch();
    }
  });

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const notifItem = nav.find((n) => n.href.endsWith("/notifications"));
  const primary = nav.filter((n) => n !== notifItem).slice(0, 4);

  return (
    <div className="flex min-h-screen bg-ground">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-navy-100 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5 font-bold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-white">⚡</span>
          {t("app.name")}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink key={n.href} item={n} active={pathname === n.href} badge={n === notifItem ? notif.data?.unread : undefined} />
          ))}
        </nav>
        <div className="border-t border-navy-100 p-3">
          <div className="px-2 py-2 text-sm">
            <div className="font-semibold text-navy-800">{user.fullName}</div>
            <div className="text-xs text-navy-400">{user.role}</div>
          </div>
          <div className="mt-1 px-2"><LanguageSelector compact /></div>
          <button className="btn-ghost mt-2 w-full" onClick={logout}>{t("nav.logout")}</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2 font-bold text-navy-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy-800 text-sm text-white">⚡</span>
            {t("app.name")}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector compact />
            <button className="btn-ghost px-3" onClick={() => setOpen((v) => !v)} aria-label={t("nav.more")}>☰</button>
          </div>
        </header>

        {open && (
          <div className="border-b border-navy-100 bg-white p-3 lg:hidden">
            {nav.map((n) => (
              <NavLink key={n.href} item={n} active={pathname === n.href} onClick={() => setOpen(false)} badge={n === notifItem ? notif.data?.unread : undefined} />
            ))}
            <button className="btn-ghost mt-2 w-full" onClick={logout}>{t("nav.logout")}</button>
          </div>
        )}

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-navy-100 bg-white lg:hidden">
          {primary.map((n) => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={n.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-navy-900" : "text-navy-400"}`}>
                <span className="text-lg">{n.icon}</span>
                {t(n.labelKey)}
              </Link>
            );
          })}
          <button onClick={() => setOpen((v) => !v)} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-navy-400">
            <span className="text-lg">☰</span>
            {t("nav.more")}
          </button>
        </nav>
      </div>
    </div>
  );
}

function NavLink({ item, active, onClick, badge }: { item: NavItem; active: boolean; onClick?: () => void; badge?: number }) {
  const { t } = useI18n();
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
        active ? "bg-navy-800 text-white" : "text-navy-600 hover:bg-navy-50"
      }`}
    >
      <span className="text-lg">{item.icon}</span>
      <span className="flex-1">{t(item.labelKey)}</span>
      {badge ? <span className="rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}
