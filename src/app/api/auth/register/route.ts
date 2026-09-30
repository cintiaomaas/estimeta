import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { registerUser } from "@/services/users";
import { apiError, handleApiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return apiError("INVALID_INPUT", "Envie um JSON válido.", 400); }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return apiError("INVALID_INPUT", parsed.error.issues[0].message, 400);
    const user = await registerUser(parsed.data);
    return NextResponse.json({ data: { user } }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
