import { requireUser } from "@/lib/auth/session";
import { ReportView } from "@/components/reports/report-view";
export default async function AnnualSummary() { await requireUser(); return <ReportView annual />; }
