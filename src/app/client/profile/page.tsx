"use client";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/ui";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function ProfilePage() {
  const { t } = useI18n();
  const { data, loading } = useApi<{ user: { fullName: string; email: string; role: string } | null }>("/api/auth/me");
  if (loading) return <LoadingState />;
  const u = data?.user;

  return (
    <div className="max-w-lg">
      <PageHeader title={t("nav.profile")} />
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-navy-800 text-xl text-white">
            {u?.fullName?.[0] ?? "?"}
          </div>
          <div>
            <div className="text-lg font-bold text-navy-900">{u?.fullName}</div>
            <div className="text-sm text-navy-400">{u?.email}</div>
          </div>
        </div>
        <div className="mt-5 border-t border-navy-100 pt-4">
          <div className="mb-1 text-sm font-medium text-navy-600">Language</div>
          <LanguageSelector />
        </div>
      </div>
    </div>
  );
}
