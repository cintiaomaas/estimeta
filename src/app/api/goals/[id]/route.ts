import { goalsContext } from "@/lib/api/goals";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const s = await goalsContext(request); const { id } = await context.params; return financeResponse({ data: await s.detail(id, Object.fromEntries(new URL(request.url).searchParams)) }); } catch (error) { return financeError(error); }
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const s = await goalsContext(request); const { id } = await context.params; return financeResponse({ data: await s.save(await readJson(request), id) }); } catch (error) { return financeError(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const s = await goalsContext(request); const { id } = await context.params; return financeResponse({ data: await s.state(id, await readJson(request)) }); } catch (error) { return financeError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const s = await goalsContext(request); const { id } = await context.params; return financeResponse({ data: await s.remove(id) }); } catch (error) { return financeError(error); }
}
