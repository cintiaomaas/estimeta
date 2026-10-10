import { requestTiming } from "@/lib/api/timing";
import { reportsContext } from "@/lib/api/reports";
import { financeError, financeResponse } from "@/lib/api/finance";
export async function GET(request: Request) {
  const timing = requestTiming();
  try {
    const service = await timing.measure("auth", () => reportsContext());
    const result = await timing.measure("data", () => service.dashboard(Object.fromEntries(new URL(request.url).searchParams)));
    return timing.finish(financeResponse({ data: result }));
  } catch (error) { return timing.finish(financeError(error)); }
}
