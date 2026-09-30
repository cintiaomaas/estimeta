import { financialActor, financeError, financeResponse, readJson } from "@/lib/api/finance";
import { prisma } from "@/lib/db/prisma";
import { planningService } from "@/services/planning";
export async function GET(request: Request) {
  try { return financeResponse({ data: await planningService(prisma, await financialActor(request)).config() }); }
  catch (error) { return financeError(error); }
}
export async function PUT(request: Request) {
  try {
    const service = planningService(prisma, await financialActor(request));
    return financeResponse({ data: await service.save(await readJson(request)) });
  } catch (error) { return financeError(error); }
}
