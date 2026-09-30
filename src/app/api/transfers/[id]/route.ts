import { advancedContext } from "@/lib/api/advanced";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { try { const service = await advancedContext(request); return financeResponse({ data: await service.transfer((await context.params).id) }); } catch(error) { return financeError(error); } }
export async function PUT(request: Request, context: Context) { try { const service = await advancedContext(request); return financeResponse({ data: await service.saveTransfer(await readJson(request), (await context.params).id) }); } catch(error) { return financeError(error); } }
export async function DELETE(request: Request, context: Context) { try { const service = await advancedContext(request); return financeResponse({ data: await service.removeTransfer((await context.params).id) }); } catch(error) { return financeError(error); } }
