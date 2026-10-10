"use client";
import dynamic from "next/dynamic";
import { DeferredChart } from "@/components/ui/deferred-chart";
import type { PlanningReport } from "@/services/planning";
import { plannedPreview } from "@/lib/finance/planning-preview";
import { currency } from "@/lib/finance/client";
import { PlanningGroupUsage, percentText, type PlanningGroup } from "./planning-group-usage";
const PlanningDonutCanvas = dynamic(() => import("./planning-donut-canvas"));
export const planningColors = ["#285b4d", "#849f35", "#c99746", "#5d8893", "#a7737d", "#746e9c"];
export function PlanningDonut({ data }: { data: PlanningReport }) {
  const available = plannedPreview(data.referenceIncome, data.remainingPercentage)!;
  const slices: { name: string; value: number; amount: string; group?: PlanningGroup }[] = [...data.groups.map(g => ({ name: g.name, value: Number(g.percentage), amount: g.planned, group: g })), { name: "Ainda disponível", value: Number(data.remainingPercentage), amount: available }];
  return <div className="planning-distribution">
    <div className="planning-donut">
      <div aria-hidden="true" inert style={{ pointerEvents: "none", height: 240 }}><DeferredChart><PlanningDonutCanvas slices={slices} colors={planningColors} /></DeferredChart></div>
      <div className="planning-donut-center"><strong>{percentText(data.totalPercentage)}%</strong><span>Planejado</span></div>
      <p className="planning-donut-amount">{currency(plannedPreview(data.referenceIncome, data.totalPercentage)!)} de {currency(data.referenceIncome)}</p>
    </div>
    <ul className="planning-legend" aria-label="Distribuição planejada e utilização dos grupos">{slices.map((s,i) => <li key={i} className={s.group ? `state-${s.group.state.toLowerCase()}` : ""}>
      <span className="planning-dot" aria-hidden="true" style={{ background: s.group ? planningColors[i % planningColors.length] : "#dfe7d5" }} />
      <div className="planning-legend-content"><strong>{s.name}</strong>{s.group ? <PlanningGroupUsage group={s.group} /> : <p>{percentText(data.remainingPercentage)}% da renda · {currency(available)} ainda não planejados</p>}</div>
    </li>)}</ul>
  </div>;
}
