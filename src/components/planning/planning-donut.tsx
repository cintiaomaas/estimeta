"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PlanningReport } from "@/services/planning";
import { plannedPreview } from "@/lib/finance/planning-preview";
import { currency } from "@/lib/finance/client";
import { PlanningGroupUsage, percentText, type PlanningGroup } from "./planning-group-usage";
export const planningColors = ["#285b4d", "#849f35", "#c99746", "#5d8893", "#a7737d", "#746e9c"];
export function PlanningDonut({ data }: { data: PlanningReport }) {
  const available = plannedPreview(data.referenceIncome, data.remainingPercentage)!;
  const slices: { name: string; value: number; amount: string; group?: PlanningGroup }[] = [...data.groups.map(g => ({ name: g.name, value: Number(g.percentage), amount: g.planned, group: g })), { name: "Ainda disponível", value: Number(data.remainingPercentage), amount: available }];
  return <div className="planning-distribution">
    <div className="planning-donut">
      <div aria-hidden="true"><ResponsiveContainer width="100%" height={240}><PieChart>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={74} outerRadius={102} stroke="var(--paper)" isAnimationActive={false}>{slices.map((s,i) => <Cell key={i} fill={s.group ? planningColors[i % planningColors.length] : "#dfe7d5"} />)}</Pie>
        <Tooltip content={({ active, payload }) => {
          const slice = payload?.[0]?.payload as (typeof slices)[number] | undefined;
          return active && slice ? <div className="chart-tooltip planning-tooltip"><strong>{slice.name}</strong>{slice.group ? <PlanningGroupUsage group={slice.group} tooltip /> : <p>{percentText(data.remainingPercentage)}% da renda · {currency(available)} ainda não planejados</p>}</div> : null;
        }} />
      </PieChart></ResponsiveContainer></div>
      <div className="planning-donut-center"><strong>{percentText(data.totalPercentage)}%</strong><span>Planejado</span></div>
      <p className="planning-donut-amount">{currency(plannedPreview(data.referenceIncome, data.totalPercentage)!)} de {currency(data.referenceIncome)}</p>
    </div>
    <ul className="planning-legend" aria-label="Distribuição planejada e utilização dos grupos">{slices.map((s,i) => <li key={i} className={s.group ? `state-${s.group.state.toLowerCase()}` : ""}>
      <span className="planning-dot" aria-hidden="true" style={{ background: s.group ? planningColors[i % planningColors.length] : "#dfe7d5" }} />
      <div className="planning-legend-content"><strong>{s.name}</strong>{s.group ? <PlanningGroupUsage group={s.group} /> : <p>{percentText(data.remainingPercentage)}% da renda · {currency(available)} ainda não planejados</p>}</div>
    </li>)}</ul>
  </div>;
}
