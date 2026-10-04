"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardReport } from "@/services/reports";
import { monthNames } from "./report-months";
export default function ReportChartCanvas({ trend }: { trend: DashboardReport["trend"] }) {
  const points = trend.map((r) => ({ ...r, label: `${monthNames[r.month - 1]}/${String(r.year).slice(-2)}`, income: Number(r.income), expenses: Number(r.expenses), netSavings: Number(r.netSavings) }));
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}><ComposedChart data={points} margin={{ top: 10, right: 10, bottom: 5, left: 0 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} /><YAxis width={55} tick={{ fontSize: 10 }} tickFormatter={(n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n)} /><Tooltip formatter={(value, name) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)), name]} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar isAnimationActive={false} name="Receitas" dataKey="income" fill="#235e4c" /><Bar isAnimationActive={false} name="Despesas" dataKey="expenses" fill="#b15a31" /><Line isAnimationActive={false} name="Economia líquida" dataKey="netSavings" stroke="#5554a1" strokeWidth={2} strokeDasharray="5 3" /></ComposedChart></ResponsiveContainer>;
}
