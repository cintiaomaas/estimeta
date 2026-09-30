import Link from "next/link";
import type { DashboardReport } from "@/services/reports";
import { currency } from "@/lib/finance/client";
import { GoalProgress } from "./goal-progress";
export function GoalSummary({ data }: { data: DashboardReport["goals"] }) {
  return <section className="panel"><div className="section-heading"><h2>Metas financeiras</h2><Link className="text-link" href="/metas">Ver todas as metas</Link></div><p className="report-note">Metas atualmente ativas, com contribuições até a competência selecionada.</p><p>{data.activeCount} metas ativas · {currency(data.totalContributed)} acumulados de {currency(data.targetAmount)}</p><GoalProgress value={data.progressPercentage} />{data.items.length ? <ul className="report-list">{data.items.map(g => <li key={g.id}><div><Link href={`/metas?meta=${g.id}`} className="text-link">{g.name}</Link><small>{currency(g.totalContributed)} / {currency(g.targetAmount)}</small></div><span>{g.progressPercentage.replace(".", ",")}%</span></li>)}</ul> : <p className="report-empty">Crie uma meta para acompanhar seus objetivos.</p>}</section>;
}
