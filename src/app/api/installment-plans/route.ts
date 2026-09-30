import { advancedContext } from "@/lib/api/advanced";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function POST(request: Request) { try { const service = await advancedContext(request); return financeResponse({ data: await service.createInstallments(await readJson(request)) }, 201); } catch(error) { return financeError(error); } }
