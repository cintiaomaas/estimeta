import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, select: {
    id: true, name: true, email: true, createdAt: true,
    membership: { select: { role: true, household: { select: { id: true, name: true } } } },
  } });
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Entre na sua conta para continuar.", 401);
  return user;
}
