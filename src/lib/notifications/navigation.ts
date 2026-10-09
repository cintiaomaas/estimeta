export function notificationLoginDestination(next?: string) {
  return next && /^\/notificacoes(?:\/[a-f0-9-]{36})?$/.test(next) ? next : "/dashboard";
}
export function notificationClickDestination(id: string, authenticated: boolean) {
  return authenticated ? `/notificacoes?selected=${id}` : `/login?next=${encodeURIComponent(`/notificacoes/${id}`)}`;
}
