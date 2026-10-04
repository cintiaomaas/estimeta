"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
export default function PlanningDonutCanvas({ slices, colors }: { slices: { name: string; value: number; group?: unknown }[]; colors: string[] }) {
  return <ResponsiveContainer width="100%" height={240}><PieChart accessibilityLayer={false}>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={74} outerRadius={102} stroke="var(--paper)" isAnimationActive={false} rootTabIndex={-1}>{slices.map((s,i) => <Cell key={i} fill={s.group ? colors[i % colors.length] : "#dfe7d5"} />)}</Pie>
      </PieChart></ResponsiveContainer>;
}
