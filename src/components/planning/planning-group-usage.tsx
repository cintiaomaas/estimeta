import type { PlanningReport } from "../../services/planning";
import { currency } from "../../lib/finance/client";

export type PlanningGroup = PlanningReport["groups"][number];
const labels: Record<string, string> = { WITHIN: "Dentro do planejado", NEAR: "Próximo do limite", REACHED: "Planejado atingido", EXCEEDED: "Acima do planejado", UNAVAILABLE: "Sem renda de referência" };
export const percentText = (value: string) => value.replace(/\.00$/, "").replace(".", ",");

export function PlanningGroupUsage({ group, tooltip = false, scaleMax = 100 }: { group: PlanningGroup; tooltip?: boolean; scaleMax?: number }) {
  const usage = group.planned === "0.00" ? null : group.utilizationPercentage;
  const usageValue = Math.max(0, Number(usage ?? 0));
  const barMax = Math.max(100, scaleMax, Math.ceil(usageValue / 50) * 50);
  const usageText = usage === null ? "Utilização indisponível (valor planejado zero)" : `${percentText(usage)}% do planejado utilizado`;
  const balanceText = group.state === "EXCEEDED" && group.excess !== null
    ? `${currency(group.excess)} acima do planejado`
    : group.remaining !== null ? `${currency(group.remaining)} restantes nesta categoria` : "Saldo da categoria indisponível";
  return <div className="planning-group-usage">
    <p>{percentText(group.percentage)}% da renda · {currency(group.planned)} planejados</p>
    <div className="planning-usage-values"><strong>{currency(group.committed)} {tooltip ? "comprometidos" : "utilizados"}</strong><span>{usageText}</span></div>
    {!tooltip && <div className="planning-usage-chart">
      <div className="planning-usage-track">
        <progress max={barMax} value={usageValue} aria-label={`${group.name}: ${usageText}`} aria-valuetext={usageText} />
        <span className="planning-usage-limit" style={{ left: `${100 / barMax * 100}%` }} aria-hidden="true" />
      </div>
      <div className="planning-usage-scale" aria-hidden="true"><span>0%</span><span>Limite planejado: 100%</span>{barMax > 100 && <span>{percentText(String(barMax))}%</span>}</div>
    </div>}
    <div className="planning-usage-state"><span>{labels[group.state]}</span><span>{balanceText}</span></div>
  </div>;
}
