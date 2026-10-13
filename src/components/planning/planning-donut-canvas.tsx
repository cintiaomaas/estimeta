"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
export default function PlanningDonutCanvas({ slices, colors }: { slices: { name: string; value: number; group?: unknown }[]; colors: string[] }) {
  return <ResponsiveContainer width="100%" height={240}><PieChart accessibilityLayer={false}>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={66} outerRadius={88} stroke="var(--paper)" isAnimationActive={false} rootTabIndex={-1}>{slices.map((s,i) => <Cell key={i} fill={s.group ? colors[i % colors.length] : "#dfe7d5"} />)}</Pie>
        <Tooltip formatter={(value) => `${Number(value).toLocaleString("pt-BR")}%`} wrapperStyle={{ zIndex: 1 }} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
      </PieChart></ResponsiveContainer>;
}
