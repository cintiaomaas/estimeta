import { advancedContext } from "@/lib/api/advanced";
import { financeError, financeResponse } from "@/lib/api/finance";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { const service = await advancedContext(request); return financeResponse({ data: await service.installment((await context.params).id) }); } catch(error) { return financeError(error); } }
