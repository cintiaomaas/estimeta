import { moneyInput, formatMoneyInput } from "./client";
/** Invalid text stays invalid; no conversion through floating point. */
export function normalizeMoneyInput(text: string) {
  const value = moneyInput(text.trim().replace(/^R\$\s*/, ""));
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(value)) return value;
  const [whole, cents = ""] = value.split(".");
  return `${BigInt(whole)}.${cents.padEnd(2, "0")}`;
}
export function displayMoneyInput(text: string) { return formatMoneyInput(normalizeMoneyInput(text)); }
