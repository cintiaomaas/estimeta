"use client";
import Link from "next/link";
import { GoalSummary } from "@/components/goals/goal-summary";
import { PlanningSummary } from "@/components/planning/planning-summary";
import { useEffect, useState } from "react";
import type { AnnualReport, DashboardReport } from "@/services/reports";
import { currency, financialRequest, statusLabels } from "@/lib/finance/client";
import { displayDate, todayInBrazil } from "@/lib/finance/dates";
import { ReportCharts } from "./report-charts";
import { monthNames } from "./report-months";
function Metric({ label, value, change }: { label: string; value: string; change?: string | null }) {
  return <article className="summary-card"><div>{label}</div><strong>{currency(value)}</strong>{change !== undefined && <small>{change === null ? "Sem comparação disponível" : `${change.startsWith("-") ? "" : "+"}${change.replace(".", ",")}% em relação ao mês anterior`}</small>}</article>;
}
function Movements({ rows, title, recent = false }: { rows: DashboardReport["topExpenses"]; title: string; recent?: boolean }) {
  return <section className="panel"><div className="section-heading"><h2>{title}</h2>{recent && <Link href="/transacoes" className="text-link">Ver todas</Link>}</div>{!rows.length ? <p className="report-empty">Nenhum lançamento {recent ? "" : "pago "}neste período.</p> : <ul className="report-list">{rows.map((row) => <li key={row.id}><div><strong>{row.description}</strong><small>{row.type === "INCOME" ? "Receita" : "Despesa"} · {row.category.name} · {row.account.name}</small><small>{recent ? statusLabels[row.displayStatus] : `Data efetiva: ${displayDate(row.transactionDate)}`}</small></div><b>{currency(row.amount)}</b></li>)}</ul>}</section>;
}
function Monthly({ data }: { data: DashboardReport }) {
  return <>{data.accountCount === 0 && <section className="panel"><h2>Comece pela sua primeira conta</h2><p>Cadastre uma conta e seu saldo inicial para organizar as movimentações.</p><Link className="button primary" href="/contas">Criar primeira conta</Link></section>}<section className="summary-grid report-metrics" aria-label="Indicadores realizados"><Metric label="Saldo ao final do período" value={data.balance} /><Metric label="Receitas realizadas" value={data.income} change={data.comparison.income} /><Metric label="Despesas realizadas" value={data.expenses} change={data.comparison.expenses} /><Metric label="Economia líquida" value={data.netSavings} change={data.comparison.netSavings} /></section><p className="report-note">Saldo acumulado por competência até o fim do período, conforme os status atuais. Somente contas marcadas para incluir no saldo geral participam, mesmo quando desativadas.</p><section className="report-forecasts" aria-label="Previsões separadas dos valores realizados"><Metric label="Receitas previstas" value={data.pendingIncome} /><Metric label="Despesas previstas" value={data.pendingExpenses} /><Metric label="Despesas atrasadas" value={data.overdueExpenses} /></section><p className="report-note">Previsões da competência selecionada. Atraso avaliado em {displayDate(data.asOf)} pelo vencimento; pendências não alteram o saldo.</p><PlanningSummary data={data.planning} /><GoalSummary data={data.goals} /><div className="report-columns"><ReportCharts trend={data.trend} /><section className="panel"><h2>Despesas por categoria</h2><p>Somente despesas pagas na competência selecionada.</p>{!data.expensesByCategory.length ? <p className="report-empty">Nenhuma despesa paga neste mês.</p> : <ul className="category-bars">{data.expensesByCategory.map((row) => <li key={row.id}><div><strong>{row.name}</strong><span>{row.percentage.replace(".", ",")}%</span></div><progress max="100" value={Number(row.percentage)} aria-label={`${row.name}: ${row.percentage}%`} /><b>{currency(row.amount)}</b></li>)}</ul>}</section></div><div className="report-columns"><Movements title="Maiores despesas" rows={data.topExpenses} /><Movements title="Movimentações recentes" rows={data.recentTransactions} recent /></div></>;
}
type TableRow = { name: string; months: string[]; total: string; average: string | null };
function AnnualTable({ title, rows }: { title: string; rows: TableRow[] }) {
  return <section className="panel"><h2>{title}</h2>{rows.length ? <div className="report-table-wrap" tabIndex={0} role="region" aria-label={`${title}, role horizontalmente para ver todos os meses`}><table className="report-table"><thead><tr><th scope="col">Indicador</th>{monthNames.map((m) => <th scope="col" key={m}>{m}</th>)}<th scope="col">Total / fechamento</th><th scope="col">Média</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th>{row.months.map((value, i) => <td key={i}>{currency(value)}</td>)}<td><b>{currency(row.total)}</b></td><td>{row.average === null ? "Não se aplica" : currency(row.average)}</td></tr>)}</tbody></table></div> : <p className="report-empty">Nenhuma categoria cadastrada ou com histórico neste ano.</p>}</section>;
}
function Annual({ data }: { data: AnnualReport }) {
  const labels = { income: "Receitas", expenses: "Despesas", netSavings: "Economia líquida", balance: "Saldo final" };
  const rows = (Object.keys(labels) as (keyof typeof labels)[]).map((key) => ({ name: labels[key], months: data.monthlySummary.map((r) => r[key]), total: data.annualTotals[key], average: key === "balance" ? null : data.averages[key] }));
  return <><section className="summary-grid report-metrics"><Metric label="Receitas do ano" value={data.annualTotals.income} /><Metric label="Despesas do ano" value={data.annualTotals.expenses} /><Metric label="Economia do ano" value={data.annualTotals.netSavings} /><Metric label="Saldo ao fim de dezembro" value={data.annualTotals.balance} /></section><p className="report-note">Valores realizados por competência, conforme os status atuais. {data.averageMonths ? `Médias: valores dos primeiros ${data.averageMonths} meses ÷ ${data.averageMonths}, incluindo meses sem movimento.` : "Ano futuro: média mensal indisponível."} O total do saldo é o fechamento de dezembro; saldos mensais não são somados nem promediados.</p><AnnualTable title="Resumo de janeiro a dezembro" rows={rows} /><AnnualTable title="Receitas por categoria" rows={data.incomeCategories.map((r) => ({ ...r, name: `${r.name}${r.isActive ? "" : " (desativada)"}` }))} /><AnnualTable title="Despesas por categoria" rows={data.expenseCategories.map((r) => ({ ...r, name: `${r.name}${r.isActive ? "" : " (desativada)"}` }))} /></>;
}
export function ReportView({ annual = false }: { annual?: boolean }) {
  const [period, setPeriod] = useState(() => ({ year: Number(todayInBrazil().slice(0, 4)), month: Number(todayInBrazil().slice(5, 7)) }));
  const [result, setResult] = useState<{ key: string; revision: number; data?: DashboardReport | AnnualReport; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${annual}/${period.year}/${annual ? 1 : period.month}`;
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1);
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const url = annual ? `/api/reports/annual?year=${period.year}` : `/api/dashboard?year=${period.year}&month=${period.month}`;
    financialRequest<{ data: DashboardReport | AnnualReport }>(url, { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) setResult({ key, revision, data }); }).catch((error: Error) => { if (!controller.signal.aborted) setResult((previous) => ({ key, revision, data: previous?.key === key ? previous.data : undefined, error: error.message })); });
    return () => controller.abort();
  }, [annual, period.year, period.month, key, revision]);
  const loading = result?.key !== key;
  const refreshing = loading || result?.revision !== revision;
  const years = [...new Set([...(result?.data?.availableYears ?? []), period.year])].sort((a, b) => b - a);
  return <div className="reports"><div className="page-heading"><div><span className="eyebrow">SEU DINHEIRO, COM CLAREZA</span><h1>{annual ? "Resumo anual" : "Visão mensal"}</h1><p>{annual ? "Acompanhe o ano e a evolução do seu saldo." : "Realizado e previsto, cada um no seu lugar."}</p></div><Link className="text-link" href={annual ? "/dashboard" : "/resumo"}>{annual ? "Ver visão mensal" : "Ver resumo anual"}</Link></div><div className="report-period">{!annual && <label>Mês<select value={period.month} onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}>{monthNames.map((m, i) => <option value={i + 1} key={m}>{m}</option>)}</select></label>}<label>Ano<select value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}>{years.map((y) => <option key={y}>{y}</option>)}</select></label><button className="button secondary" onClick={() => setRevision((r) => r + 1)} disabled={refreshing}>{refreshing ? "Atualizando…" : "Atualizar"}</button></div>{!loading && result?.error && result.data && <p role="alert">Não foi possível atualizar o resumo: {result.error}</p>}{loading ? <p role="status" className="panel">Carregando seu resumo…</p> : result?.error && !result.data ? <div role="alert" className="panel"><p>{result.error}</p><button className="button secondary" onClick={() => setRevision((r) => r + 1)}>Tentar novamente</button></div> : result?.data && (annual ? <Annual data={result.data as AnnualReport} /> : <Monthly data={result.data as DashboardReport} />)}</div>;
}



