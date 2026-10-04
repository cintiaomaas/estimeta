import { requireUser } from "@/lib/auth/session";
import { TransactionsManager } from "@/components/finance/transactions-manager";
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireUser();
  const { period } = await searchParams;
  const initialPeriod = period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? `${period}-01` : undefined;
  return <TransactionsManager key={initialPeriod ?? "current"} fixedType="EXPENSE" initialPeriod={initialPeriod} />;
}
