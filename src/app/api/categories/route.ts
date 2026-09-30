import { financeContext, financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function GET(request: Request) {
  try {
    const service = await financeContext(request);
    const result = await service.categories(Object.fromEntries(new URL(request.url).searchParams));
    return financeResponse({ data: result });
  } catch (error) { return financeError(error); }
}
export async function POST(request: Request) {
  try {
    const service = await financeContext(request);
    return financeResponse({ data: await service.saveCategory(await readJson(request)) }, 201);
  } catch (error) { return financeError(error); }
}

