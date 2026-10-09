import { auth } from "@/lib/auth";
import { financialActor, financeError, financeResponse, readJson } from "@/lib/api/finance";
import { prisma } from "@/lib/db/prisma";
import { pushSubscriptions } from "@/services/push-subscriptions";

export async function POST(request: Request) {
  try {
    const { userId } = await financialActor(request);
    const session = await auth();
    return financeResponse({ data: await pushSubscriptions(prisma, userId).save(await readJson(request), session?.sessionId ? { sessionId: session.sessionId, expiresAt: new Date(session.expires) } : undefined) });
  } catch (error) { return financeError(error); }
}
export async function DELETE(request: Request) {
  try {
    const { userId } = await financialActor(request);
    return financeResponse({ data: await pushSubscriptions(prisma, userId).remove(await readJson(request)) });
  } catch (error) { return financeError(error); }
}
