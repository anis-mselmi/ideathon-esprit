"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function TelemetryChart({
  data,
  dataKey,
  color,
  unit,
}: {
  data: { t: string; value: number }[];
  dataKey?: string;
  color: string;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f9" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#7f97c8" }} interval="preserveStartEnd" tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#7f97c8" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #d5def0", fontSize: 12 }}
          formatter={(v: number) => [`${v}${unit ?? ""}`, dataKey ?? "value"]}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
