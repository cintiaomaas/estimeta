import { goalsContext } from "@/lib/api/goals";
import { financeError, financeResponse, readJson } from "@/lib/api/finance";
export async function GET(request: Request) {
 try { const s = await goalsContext(request); return financeResponse(await s.list(Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return financeError(error); }
}
export async function POST(request: Request) {
 try { const s = await goalsContext(request); return financeResponse({ data: await s.save(await readJson(request)) }, 201); } catch (error) { return financeError(error); }
}
