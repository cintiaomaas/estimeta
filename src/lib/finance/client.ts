export type AccountRecord = { bankCode?: string | null; id: string; name: string; type: string; initialBalance: string; isActive: boolean; includeInTotalBalance: boolean; balance?: string; balancePeriod?: string };
export type CategoryRecord = { id: string; name: string; type: "INCOME" | "EXPENSE"; isActive: boolean };
export type TransactionRecord = {
  installmentPlanId?: string | null; installmentNumber?: number | null; installmentCount?: number | null; recurringOccurrenceId?: string | null;
  id: string; type: "INCOME" | "EXPENSE"; description: string; amount: string; accountId: string; categoryId: string;
  scheduledDate: string; transactionDate: string | null; competenceDate: string; status: string; displayStatus: string; notes: string | null;
  account: { id: string; name: string; isActive: boolean }; category: { id: string; name: string; isActive: boolean };
};
export const accountLabels: Record<string, string> = { CHECKING: "Conta corrente", SAVINGS: "Poupança", CASH: "Dinheiro", INVESTMENT: "Investimento", OTHER: "Outra" };
export const statusLabels: Record<string, string> = { PENDING: "Previsto", RECEIVED: "Recebido", PAID: "Pago", OVERDUE: "Atrasada" };
export function currency(value: string) {
  const [whole, cents = "00"] = value.split(".");
  return `${whole.startsWith("-") ? "-" : ""}R$ ${BigInt(whole.replace("-", "")).toLocaleString("pt-BR")},${cents.padEnd(2, "0")}`;
}
/** Accept plain decimal or Brazilian grouping; server still validates precision/range. */
export function moneyInput(value: string) {
  const trimmed = value.trim();
  // Validate grouping before removing separators; never silently round excess cents.
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(trimmed)) return trimmed.replace(/\./g, "").replace(",", ".");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed)) return trimmed.replace(/\./g, "");
  return trimmed;
}
export function formatMoneyInput(value: string) {
  const normalized = moneyInput(value);
  return /^\d{1,13}(?:\.\d{1,2})?$/.test(normalized) ? currency(normalized).slice(3) : value;
}
export async function financialRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Não foi possível concluir a solicitação.");
  return result as T;
}
