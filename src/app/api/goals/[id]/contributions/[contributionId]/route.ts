import { goalsContext } from "@/lib/api/goals";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function PUT(request: Request, context: { params: Promise<{ id: string; contributionId: string }> }) {
 try { const s = await goalsContext(request); const { id, contributionId } = await context.params; return financeResponse({ data: await s.contribution(id, await readJson(request), contributionId) }); } catch (error) { return financeError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string; contributionId: string }> }) {
 try { const s = await goalsContext(request); const { id, contributionId } = await context.params; return financeResponse({ data: await s.removeContribution(id, contributionId) }); } catch (error) { return financeError(error); }
}
