import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
export async function GET() {
  try { return NextResponse.json({ data: { user: await requireApiUser() } }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return handleApiError(error); }
}
