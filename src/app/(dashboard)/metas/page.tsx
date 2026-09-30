import { requireUser } from "@/lib/auth/session";
import { GoalsManager } from "@/components/goals/goals-manager";
export default async function Page() { await requireUser(); return <GoalsManager />; }
