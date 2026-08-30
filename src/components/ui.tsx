"use client";

import { useI18n } from "@/lib/i18n";

// ---- Severity + status badges (never color-only: always icon + text) ----

const SEV_STYLE: Record<string, { bg: string; text: string; dot: string; icon: string }> = {
  CRITICAL: { bg: "bg-critical/10", text: "text-critical", dot: "bg-critical", icon: "🔴" },
  HIGH: { bg: "bg-critical/10", text: "text-critical", dot: "bg-critical", icon: "🔴" },
  MEDIUM: { bg: "bg-warn/10", text: "text-warn", dot: "bg-warn", icon: "🟠" },
  LOW: { bg: "bg-healthy/10", text: "text-healthy", dot: "bg-healthy", icon: "🟢" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useI18n();
  const s = SEV_STYLE[severity] ?? SEV_STYLE.LOW;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {t(`sev.${severity}`) || severity}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-healthy/10 text-healthy",
  READY: "bg-healthy/10 text-healthy",
  RENTED: "bg-info/10 text-info",
  ASSIGNED: "bg-info/10 text-info",
  CHARGING: "bg-info/10 text-info",
  MAINTENANCE: "bg-warn/10 text-warn",
  ATTENTION: "bg-warn/10 text-warn",
  AT_RISK: "bg-critical/10 text-critical",
  SERVICE: "bg-critical/10 text-critical",
  OFFLINE: "bg-navy-100 text-navy-500",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-navy-100 text-navy-600"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label ?? status.replace("_", " ").toLowerCase()}
    </span>
  );
}

// ---- Dashboard stat card ----

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "healthy" | "warn" | "critical" | "info";
}) {
  const toneText =
    tone === "healthy" ? "text-healthy" : tone === "warn" ? "text-warn" : tone === "critical" ? "text-critical" : tone === "info" ? "text-info" : "text-navy-900";
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneText}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-navy-400">{hint}</div>}
    </div>
  );
}

// ---- Risk gauge (0..100) ----

export function RiskScore({ score, size = 64 }: { score: number; size?: number }) {
  const tone = score >= 75 ? "#dc2626" : score >= 55 ? "#d97706" : score >= 35 ? "#d97706" : "#16a34a";
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(score, 100) / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rtl-flip">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f9" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={6}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums" style={{ color: tone }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

// ---- Empty / loading / error states ----

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-navy-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
      {label ?? t("common.loading")}
    </div>
  );
}

export function EmptyState({ title, hint, icon = "📭" }: { title?: string; hint?: string; icon?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-4xl" aria-hidden>{icon}</div>
      <div className="font-semibold text-navy-700">{title ?? t("common.empty")}</div>
      {hint && <div className="max-w-sm text-sm text-navy-400">{hint}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-3xl" aria-hidden>⚠️</div>
      <div className="font-medium text-navy-700">{message ?? t("common.error")}</div>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
