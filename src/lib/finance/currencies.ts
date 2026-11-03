export const currencyCodes = ["BRL", "USD", "EUR", "ARS"] as const;
export type CurrencyCode = typeof currencyCodes[number];
export const currencyLabels: Record<CurrencyCode, string> = { BRL: "Real (BRL)", USD: "Dólar americano (USD)", EUR: "Euro (EUR)", ARS: "Peso argentino (ARS)" };
export function foreignMoney(value: string, code: string) {
  const negative = value.startsWith("-");
  const [whole, cents = "00"] = value.replace(/^-/, "").split(".");
  return `${negative ? "−" : ""}${code} ${BigInt(whole).toLocaleString("pt-BR")},${cents.padEnd(2, "0")}`;
}
