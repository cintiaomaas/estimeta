import { AppError } from "./errors";

export function assertRequestOrigin(request: Request, localPreview = false) {
  if (["GET", "HEAD"].includes(request.method)) return;
  // The isolated launcher binds this exact loopback origin. Do not derive trust
  // from Host/X-Forwarded-Host, or weaken production origin checks.
  const expected = localPreview ? "http://127.0.0.1:3100" : new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if ((origin && origin !== expected) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError("FORBIDDEN", "Origem da solicitação não permitida.", 403);
  }
}
