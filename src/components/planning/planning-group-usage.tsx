import type { PlanningReport } from "../../services/planning";
import { currency } from "../../lib/finance/client";

export type PlanningGroup = PlanningReport["groups"][number];
const labels: Record<string, string> = { WITHIN: "Dentro do planejado", NEAR: "Próximo do limite", REACHED: "Planejado atingido", EXCEEDED: "Acima do planejado", UNAVAILABLE: "Sem renda de referência" };
export const percentText = (value: string) => value.replace(/\.00$/, "").replace(".", ",");

export function PlanningGroupUsage({ group, tooltip = false }: { group: PlanningGroup; tooltip?: boolean }) {
  // All financial values and states come from the existing report. Only the bar is capped.
  const usage = group.planned === "0.00" ? null : group.utilizationPercentage;
  const usageText = usage === null ? "Utilização indisponível (valor planejado zero)" : `${percentText(usage)}% do planejado utilizado`;
  const balanceText = group.state === "EXCEEDED" && group.excess !== null
    ? `${currency(group.excess)} acima do planejado`
    : group.remaining !== null ? `${currency(group.remaining)} disponíveis` : "Disponibilidade indisponível";
  return <div className="planning-group-usage">
    <p>{percentText(group.percentage)}% da renda · {currency(group.planned)} planejados</p>
    <div className="planning-usage-values"><strong>{currency(group.committed)} {tooltip ? "comprometidos" : "utilizados"}</strong><span>{usageText}</span></div>
    {!tooltip && <progress max={100} value={usage === null ? 0 : Math.min(100, Math.max(0, Number(usage)))} aria-label={`${group.name}: ${usageText}`} aria-valuetext={usageText} />}
    <div className="planning-usage-state"><span>{labels[group.state]}</span><span>{balanceText}</span></div>
  </div>;
}
