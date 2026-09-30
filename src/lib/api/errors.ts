import { NextResponse } from "next/server";
export class AppError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function handleApiError(error: unknown) {
  if (error instanceof AppError) return apiError(error.code, error.message, error.status);
  // Never log the original error: database errors may contain credentials or values.
  console.error(JSON.stringify({ event: "api.unexpected_error", timestamp: new Date().toISOString() }));
  return apiError("INTERNAL_ERROR", "Não foi possível concluir a solicitação. Tente novamente.", 500);
}
