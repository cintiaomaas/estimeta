import { requireUser } from "@/lib/auth/session";
import { TransactionsManager } from "@/components/finance/transactions-manager";
export default async function Page() { await requireUser(); return <TransactionsManager fixedType="INCOME" />; }

