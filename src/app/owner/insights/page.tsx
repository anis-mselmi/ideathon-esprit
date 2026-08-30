"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, LoadingState, ErrorState } from "@/components/ui";

interface Insights {
  utilization: number; revenue: number; avgHealth: number; avgRentalHours: number; rentalCount: number;
  batteryDistribution: { band: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  incidentsByType: { type: string; count: number }[];
}

const PIE = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#94a3b8"];

export default function InsightsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<Insights>("/api/insights");

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title={t("insights.title")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("insights.utilization")} value={`${data.utilization}%`} tone="info" />
        <StatCard label={t("insights.revenue")} value={`${data.revenue} DT`} tone="healthy" />
        <StatCard label={t("insights.avgHealth")} value={`${data.avgHealth}%`} tone={data.avgHealth >= 60 ? "healthy" : "warn"} />
        <StatCard label={t("insights.avgRental")} value={`${data.avgRentalHours} h`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-navy-700">{t("insights.batteryDist")}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.batteryDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f9" vertical={false} />
              <XAxis dataKey="band" tick={{ fontSize: 11, fill: "#7f97c8" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#7f97c8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d5def0", fontSize: 12 }} />
              <Bar dataKey="count" fill="#2d4373" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-navy-700">Fleet status</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.statusDistribution.filter((s) => s.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.status} (${e.count})`} labelLine={false} fontSize={11}>
                {data.statusDistribution.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d5def0", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {data.incidentsByType.length > 0 && (
          <div className="card p-4 lg:col-span-2">
            <div className="mb-3 text-sm font-semibold text-navy-700">{t("insights.incidents")}</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.incidentsByType} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7f97c8" }} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "#7f97c8" }} width={140} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d5def0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#dc2626" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
