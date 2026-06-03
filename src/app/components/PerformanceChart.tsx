"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PerfDatum {
  name: string;
  volume: number;
  target: number;
}

export function PerformanceChart({ data }: { data: PerfDatum[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={(v) => `${Math.round(Number(v) / 1000)}K`}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#242424",
              border: "1px solid rgba(201,160,82,0.3)",
              borderRadius: 8,
              color: "#fff",
            }}
            formatter={(v: number, key) => [`${new Intl.NumberFormat("en-US").format(v)} OMR`, key]}
          />
          <Bar dataKey="target" radius={[4, 4, 0, 0]} fill="rgba(255,255,255,0.10)" />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.volume >= d.target ? "#34D399" : "#C9A052"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
