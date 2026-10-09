import { requireUser } from "@/lib/auth/session";
import { TransactionsManager } from "@/components/finance/transactions-manager";
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; selected?: string }> }) {
  await requireUser();
  const { period, selected } = await searchParams;
  const initialPeriod = period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? `${period}-01` : undefined;
  return <TransactionsManager key={initialPeriod ?? "current"} selectedId={selected && /^[a-f0-9-]{36}$/.test(selected) ? selected : undefined} fixedType="EXPENSE" initialPeriod={initialPeriod} />;
}
