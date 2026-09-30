/** Display preview only. Server planning calculations remain the source of truth. */
export function plannedPreview(income: string, percentage: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(income) || !/^\d+(?:\.\d{1,2})?$/.test(percentage)) return null;
  const units = (v: string) => { const [w, f = ""] = v.split("."); return BigInt(w) * 100n + BigInt(f.padEnd(2, "0")); };
  const cents = (units(income) * units(percentage) + 5000n) / 10000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
