import { requireUser } from "@/lib/auth/session";
import { AdvancedManager } from "@/components/finance/advanced-manager";
export default async function Page() { await requireUser(); return <AdvancedManager kind="recurring-transactions" />; }
