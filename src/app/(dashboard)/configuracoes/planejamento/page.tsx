import { requireUser } from "@/lib/auth/session";
import { PlanningSettings } from "@/components/planning/planning-settings";
export default async function Page() { await requireUser(); return <PlanningSettings />; }
