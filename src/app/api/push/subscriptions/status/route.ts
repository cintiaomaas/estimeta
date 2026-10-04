import { financialActor, financeError, financeResponse, readJson } from "@/lib/api/finance";
import { prisma } from "@/lib/db/prisma";
import { pushSubscriptions } from "@/services/push-subscriptions";

// Body instead of query string keeps subscription endpoints out of access logs.
export async function POST(request: Request) {
  try {
    const { userId } = await financialActor(request);
    return financeResponse({ data: await pushSubscriptions(prisma, userId).status(await readJson(request)) });
  } catch (error) { return financeError(error); }
}
