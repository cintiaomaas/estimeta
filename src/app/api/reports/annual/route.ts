import { reportsContext } from "@/lib/api/reports";
import { financeError, financeResponse } from "@/lib/api/finance";
export async function GET(request: Request) {
  try {
    const service = await reportsContext();
    return financeResponse({ data: await service.annual(Object.fromEntries(new URL(request.url).searchParams)) });
  } catch (error) { return financeError(error); }
}
