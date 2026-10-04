import "server-only";
import webpush from "web-push";
import { AppError } from "../api/errors";
import { isPushEndpoint } from "../validations/push";
import type { PushSender } from "../../services/due-notifications";

export function createPushSender(): PushSender {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new AppError("PUSH_NOT_CONFIGURED", "Notificações ainda não configuradas no servidor.", 503);
  // Validate before claiming any delivery.
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return async (subscription, message) => {
    if (!isPushEndpoint(subscription.endpoint)) throw new Error("Unsupported push service");
    return webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), {
      vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: "normal", timeout: 5000,
    });
  };
}
