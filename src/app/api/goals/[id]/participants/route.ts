import { goalsContext } from "@/lib/api/goals";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const s = await goalsContext(request); const { id } = await context.params; return financeResponse({ data: await s.participant(id, await readJson(request)) }, 201); } catch (error) { return financeError(error); }
}
