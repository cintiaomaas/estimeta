import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session { sessionId?: string; user: { id: string } & DefaultSession["user"] }
}
