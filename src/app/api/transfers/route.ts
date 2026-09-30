import { advancedContext } from "@/lib/api/advanced";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function GET(request: Request) { try { const service = await advancedContext(request); return financeResponse(await service.transfers(Object.fromEntries(new URL(request.url).searchParams))); } catch(error) { return financeError(error); } }
export async function POST(request: Request) { try { const service = await advancedContext(request); return financeResponse({ data: await service.saveTransfer(await readJson(request)) }, 201); } catch(error) { return financeError(error); } }
