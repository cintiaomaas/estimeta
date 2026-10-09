import { notificationClickDestination } from "@/lib/notifications/navigation";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const session = await auth();
  const destination = notificationClickDestination(id, !!session?.user?.id);
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
