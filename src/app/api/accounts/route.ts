import { requestTiming } from "@/lib/api/timing";
import { financeContext, financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function GET(request: Request) {
  const timing = requestTiming();
  try {
    const service = await timing.measure("auth", () => financeContext(request));
    const result = await timing.measure("data", () => service.accounts(Object.fromEntries(new URL(request.url).searchParams)));
    return timing.finish(financeResponse({ data: result }));
  } catch (error) { return timing.finish(financeError(error)); }
}
export async function POST(request: Request) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.saveAccount(await readJson(request)) }, 201);
  } catch (error) { return financeError(error); }
}

