import { financeContext, financeError, financeResponse, readJson } from "@/lib/api/finance";

export async function PUT(request: Request) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.reorderAccounts(await readJson(request)) });
  } catch (error) { return financeError(error); }
}
