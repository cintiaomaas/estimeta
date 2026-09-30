import Link from "next/link";
import type { PlanningReport } from "@/services/planning";
import { currency } from "@/lib/finance/client";
import { PlanningDonut } from "./planning-donut";
import { percentText } from "./planning-group-usage";
export function PlanningSummary({ data }: { data: PlanningReport }) {
  if (!data.enabled) return <section className="panel planning-summary"><h2>Planejamento da renda</h2><p>Distribua sua renda entre grupos e acompanhe os compromissos do mês.</p><Link className="text-link" href="/configuracoes/planejamento">Configurar planejamento →</Link></section>;
  return <section className="panel planning-summary"><div className="section-heading"><h2>Planejamento da renda</h2><Link className="text-link" href="/configuracoes/planejamento">Ajustar planejamento →</Link></div>
    <p>Base: {currency(data.referenceIncome)} · {data.incomeSource === "MANUAL" ? "renda informada" : "renda realizada no mês"} · {percentText(data.totalPercentage)}% planejados · {percentText(data.remainingPercentage)}% ainda disponíveis para planejar.</p>
    <p className="report-note">Utilizado inclui despesas pagas e pendentes da competência.</p>
    <PlanningDonut data={data} />
    {!data.available && <p role="status" className="alert">Sem renda de referência neste período. A distribuição percentual permanece visível.</p>}
    {data.unclassified !== "0.00" && <div className="planning-attention"><strong>Atenção no planejamento</strong><p>{currency(data.unclassified)} em despesas sem grupo ativo no planejamento.</p><Link className="text-link" href="/configuracoes/planejamento">Revisar categorias →</Link></div>}
  </section>;
}
