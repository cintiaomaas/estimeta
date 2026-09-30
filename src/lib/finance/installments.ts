import { decimal } from "./report-math";

export function splitInstallments(total: string, count: number) {
  const cents = decimal(total).mul(100);
  if (!Number.isInteger(count) || count < 2 || count > 360 || !cents.isInteger() || cents.lt(count)) throw new Error("Informe de 2 a 360 parcelas, com pelo menos R$ 0,01 por parcela.");
  const base = cents.div(count).floor();
  const remainder = cents.mod(count);
  return Array.from({ length: count }, (_, index) => base.plus(remainder.gt(index) ? 1 : 0).div(100).toFixed(2));
}
