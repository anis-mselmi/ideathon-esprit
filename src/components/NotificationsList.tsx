"use client";

import { useI18n } from "@/lib/i18n";
import { api, useApi } from "@/lib/client";
import { useRealtime } from "@/lib/realtime";
import { PageHeader } from "./PageHeader";
import { LoadingState, ErrorState, EmptyState } from "./ui";

interface Notif { id: string; type: string; title: string; body: string; severity: string; read: boolean; createdAt: string; }

const ICON: Record<string, string> = { CRITICAL: "🔴", WARN: "🟠", INFO: "🔵" };

export function NotificationsList() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<{ notifications: Notif[]; unread: number }>("/api/notifications");
  useRealtime((e) => e.type === "notification" && refetch());

  async function markRead(id: string) {
    await api(`/api/notifications/${id}`, { method: "PATCH" });
    refetch();
  }

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t("notif.title")} />
      {!data?.notifications.length ? (
        <div className="card"><EmptyState title={t("notif.allRead")} icon="🔔" /></div>
      ) : (
        <div className="card divide-y divide-navy-100">
          {data.notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? "opacity-60" : ""}`}>
              <span className="text-lg" aria-hidden>{ICON[n.severity] ?? "🔵"}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy-900">{n.title}</div>
                <div className="text-sm text-navy-500">{n.body}</div>
                <div className="mt-0.5 text-xs text-navy-400">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.read && (
                <button className="shrink-0 text-xs font-medium text-navy-500 hover:text-navy-800" onClick={() => markRead(n.id)}>
                  {t("notif.markRead")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
