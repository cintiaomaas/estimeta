import { goalsContext } from "@/lib/api/goals";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function PUT(request: Request, context: { params: Promise<{ id: string; participantId: string }> }) {
 try { const s = await goalsContext(request); const { id, participantId } = await context.params; return financeResponse({ data: await s.participant(id, await readJson(request), participantId) }); } catch (error) { return financeError(error); }
}
