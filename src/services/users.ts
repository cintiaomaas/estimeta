import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/api/errors";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { defaultCategories } from "@/lib/finance/defaults";

const duplicateEmail = () => new AppError("EMAIL_ALREADY_EXISTS", "Já existe uma conta cadastrada com este e-mail.", 409);
export async function registerUser(input: RegisterInput) {
  const data = registerSchema.parse(input);
  if (await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })) throw duplicateEmail();
  const passwordHash = await hashPassword(data.password);
  try {
    // Nested writes are atomic: the user, household and membership either all exist or none do.
    return await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash,
        membership: { create: { role: "OWNER", household: { create: { name: `Casa de ${data.name}`, financialDefaultsAt: new Date(), categories: { create: defaultCategories } } } } },
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw duplicateEmail();
    throw error;
  }
}
