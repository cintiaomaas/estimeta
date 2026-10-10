"use client";
import dynamic from "next/dynamic";
import { DeferredChart } from "@/components/ui/deferred-chart";
import { monthNames } from "./report-months";
import type { DashboardReport } from "@/services/reports";
import { currency } from "@/lib/finance/client";
const ReportChartCanvas = dynamic(() => import("./report-chart-canvas"));
export function ReportCharts({ trend }: { trend: DashboardReport["trend"] }) {
  const hasData = trend.some((r) => r.income !== "0.00" || r.expenses !== "0.00");
  return <section className="panel report-chart"><h2>Evolução financeira</h2><p>Receitas, despesas e economia nos seis meses até o período selecionado.</p>{hasData ? <div className="chart-canvas"><DeferredChart><ReportChartCanvas trend={trend} /></DeferredChart></div> : <p className="report-empty">Nenhuma receita ou despesa realizada nestes seis meses.</p>}<details><summary>Ver valores da evolução</summary><div className="report-table-wrap" tabIndex={0} role="region" aria-label="Valores da evolução financeira"><table className="report-table"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Economia</th></tr></thead><tbody>{trend.map((r) => <tr key={`${r.year}-${r.month}`}><th>{monthNames[r.month - 1]}/{r.year}</th><td>{currency(r.income)}</td><td>{currency(r.expenses)}</td><td>{currency(r.netSavings)}</td></tr>)}</tbody></table></div></details></section>;
}

