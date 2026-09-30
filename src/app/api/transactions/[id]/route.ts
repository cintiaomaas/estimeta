import { financeContext, financeError, financeResponse, readJson } from "@/lib/api/finance";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.transaction((await context.params).id) });
  } catch (error) { return financeError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.saveTransaction(await readJson(request), (await context.params).id) });
  } catch (error) { return financeError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.removeTransaction((await context.params).id) });
  } catch (error) { return financeError(error); }
}

