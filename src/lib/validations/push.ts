import { z } from "zod";

// Only known browser push services may be contacted by the server (SSRF).
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}
export const pushEndpointSchema = z.object({ endpoint: z.string().max(2048).refine(isPushEndpoint, "Serviço de push não compatível.") }).strict();
export const pushSubscriptionSchema = pushEndpointSchema.extend({
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/, "Chave de push inválida."),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/, "Chave de autenticação inválida."),
  }).strict(),
}).strict();
