import { requireUser } from "@/lib/auth/session";
import { ReportView } from "@/components/reports/report-view";
export default async function Dashboard() { await requireUser(); return <ReportView />; }
