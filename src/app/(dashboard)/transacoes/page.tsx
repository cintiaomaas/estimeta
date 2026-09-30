import { requireUser } from "@/lib/auth/session";
import { TransactionsManager } from "@/components/finance/transactions-manager";
export default async function Page({ searchParams }: { searchParams: Promise<{ novo?: string; year?: string; month?: string }> }) {
  await requireUser();
  const { novo, year, month } = await searchParams;
  const valid = /^\d{4}$/.test(year ?? "") && Number(year) >= 1000 && Number(year) <= 9999 && /^\d{1,2}$/.test(month ?? "") && Number(month) >= 1 && Number(month) <= 12;
  const period = valid ? `${year}-${String(Number(month)).padStart(2, "0")}` : undefined;
  return <TransactionsManager key={period ?? "current"} initialPeriod={period} openNew={novo === "INCOME" || novo === "EXPENSE" ? novo : undefined} />;
}
