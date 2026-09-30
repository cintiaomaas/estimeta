import { advancedContext } from "@/lib/api/advanced";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const service = await advancedContext(request); return financeResponse({ data: await service.generateRecurring((await context.params).id, await readJson(request)) }); } catch(error) { return financeError(error); } }
