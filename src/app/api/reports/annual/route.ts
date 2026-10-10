import { reportsContext } from "@/lib/api/reports";
import { financeError, financeResponse } from "@/lib/api/finance";
import { requestTiming } from "@/lib/api/timing";
export async function GET(request: Request) {
  const timing = requestTiming();
  try {
    const service = await timing.measure("auth", () => reportsContext(timing.measure));
    const result = await timing.measure("data", () => service.annual(Object.fromEntries(new URL(request.url).searchParams)));
    return timing.finish(financeResponse({ data: result }));
  } catch (error) { return timing.finish(financeError(error)); }
}
