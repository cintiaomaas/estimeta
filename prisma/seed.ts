import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { passwordSchema } from "../src/lib/validations/auth";
import { defaultCategories } from "../src/lib/finance/defaults";
import { splitInstallments } from "../src/lib/finance/installments";
import { addMonthsClamped } from "../src/lib/finance/months";
const prisma = new PrismaClient();
class SeedConfigurationError extends Error {}
async function main() {
  if (process.env.NODE_ENV === "production") throw new SeedConfigurationError("Seed permitido apenas em desenvolvimento.");
  if (!process.env.SEED_PASSWORD) throw new SeedConfigurationError("Defina SEED_PASSWORD no arquivo .env antes de executar o seed.");
  const parsedPassword = passwordSchema.safeParse(process.env.SEED_PASSWORD);
  if (!parsedPassword.success) {
    throw new SeedConfigurationError(`SEED_PASSWORD inválida: ${parsedPassword.error.issues.map((issue) => issue.message).join(" ")}`);
  }
  const password = parsedPassword.data;
  const email = "demo@estimeta.example";
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({ where: { email }, update: {}, create: { name: "Pessoa Exemplo", email, passwordHash } });
    const membership = await tx.householdMember.upsert({ where: { userId: user.id }, update: {}, create: {
      user: { connect: { id: user.id } }, role: "OWNER", household: { create: { name: "Casa de Exemplo" } },
    } });
    const householdId = membership.householdId;
    await tx.category.createMany({ data: defaultCategories.map((category) => ({ ...category, householdId })), skipDuplicates: true });
    await tx.household.update({ where: { id: householdId }, data: { financialDefaultsAt: new Date() } });
    const account = await tx.account.upsert({ where: { id: "d0000000-0000-4000-8000-000000000001" }, update: {}, create: { id: "d0000000-0000-4000-8000-000000000001", householdId, name: "Conta Corrente Demo", type: "CHECKING", initialBalance: "1000.00" } });
    const wallet = await tx.account.upsert({ where: { id: "d0000000-0000-4000-8000-000000000002" }, update: {}, create: { id: "d0000000-0000-4000-8000-000000000002", householdId, name: "Carteira Demo", type: "CASH", initialBalance: "100.00" } });
    if (account.householdId !== householdId || wallet.householdId !== householdId) throw new SeedConfigurationError("IDs de demonstração já pertencem a outro espaço. Nenhum dado foi alterado.");
    await tx.category.upsert({ where: { householdId_type_name: { householdId, type: "EXPENSE", name: "Cartão de crédito" } }, update: {}, create: { householdId, type: "EXPENSE", name: "Cartão de crédito" } });
    for (const [suffix, type, categoryName, description, amount, status] of [
      ["11", "INCOME", "Salário", "Salário Demo", "3500.00", "RECEIVED"],
      ["12", "EXPENSE", "Internet", "Internet Demo", "120.00", "PENDING"],
      ["13", "EXPENSE", "Alimentação", "Mercado Demo", "180.50", "PAID"],
      ["14", "EXPENSE", "Cartão de crédito", "Cartão Nubank Demo", "1850.00", "PENDING"],
    ] as const) {
      const category = await tx.category.findUniqueOrThrow({ where: { householdId_type_name: { householdId, type, name: categoryName } } });
      const id = `d0000000-0000-4000-8000-0000000000${suffix}`;
      const existing = await tx.transaction.findFirst({ where: { id } });
      if (existing && existing.householdId !== householdId) throw new SeedConfigurationError("ID de lançamento demo pertence a outro espaço.");
      await tx.transaction.upsert({ where: { id }, update: {}, create: { id, householdId, accountId: type === "INCOME" ? account.id : wallet.id, categoryId: category.id, type, description, amount, status, scheduledDate: new Date("2026-09-10T00:00:00Z"), transactionDate: status === "PENDING" ? null : new Date("2026-09-10T00:00:00Z"), competenceDate: new Date("2026-09-01T00:00:00Z"), createdBy: user.id } });
    }
    const goalId = "d0000000-0000-4000-8000-000000000050";
    const existingGoal = await tx.financialGoal.findUnique({ where: { id: goalId } });
    if (existingGoal && existingGoal.householdId !== householdId) throw new SeedConfigurationError("ID de meta demo pertence a outro espaço.");
    if (!existingGoal) {
      await tx.financialGoal.create({ data: { id: goalId, householdId, createdBy: user.id, name: "Viagem Itália", targetAmount: "10000", startDate: new Date("2026-09-01"), targetDate: new Date("2027-05-31"), icon: "travel" } });
      for (const [name, amount] of [["Cintia", "1500"], ["João", "1000"]]) {
        const participant = await tx.goalParticipant.create({ data: { householdId, goalId, name } });
        await tx.goalContribution.create({ data: { householdId, goalId, participantId: participant.id, createdBy: user.id, amount, contributionDate: new Date("2026-09-15"), competenceDate: new Date("2026-09-01") } });
      }
    }
    const category = await tx.category.findUniqueOrThrow({ where: { householdId_type_name: { householdId, type: "EXPENSE", name: "Internet" } } });
    const planId = "d0000000-0000-4000-8000-000000000020", ruleId = "d0000000-0000-4000-8000-000000000030", transferId = "d0000000-0000-4000-8000-000000000040";
    const existingPlan = await tx.installmentPlan.findUnique({ where: { id: planId } });
    const existingRule = await tx.recurringTransaction.findUnique({ where: { id: ruleId } });
    const existingTransfer = await tx.transfer.findUnique({ where: { id: transferId } });
    if ([existingPlan, existingRule, existingTransfer].some((r) => r && r.householdId !== householdId)) throw new SeedConfigurationError("ID avançado demo pertence a outro espaço.");
    if (!existingPlan) {
      await tx.installmentPlan.create({ data: { id: planId, householdId, createdBy: user.id, description: "Notebook Demo", totalAmount: "1000", installmentCount: 3, firstCompetenceDate: new Date("2027-01-01") } });
      for (const [index, amount] of splitInstallments("1000", 3).entries()) await tx.transaction.create({ data: { householdId, createdBy: user.id, accountId: account.id, categoryId: category.id, type: "EXPENSE", description: "Notebook Demo", amount, status: "PENDING", scheduledDate: new Date(addMonthsClamped("2027-01-31", index)), competenceDate: new Date(addMonthsClamped("2027-01-01", index)), installmentPlanId: planId, installmentNumber: index + 1, installmentCount: 3 } });
    }
    if (!existingRule) {
      await tx.recurringTransaction.create({ data: { id: ruleId, householdId, createdBy: user.id, accountId: account.id, categoryId: category.id, type: "EXPENSE", description: "Internet mensal Demo", amount: "120", startDate: new Date("2027-01-01"), dayOfMonth: 10 } });
      for (let index = 0; index < 3; index++) {
        const competenceDate = new Date(addMonthsClamped("2027-01-01", index));
        const occurrence = await tx.recurringOccurrence.create({ data: { householdId, recurringTransactionId: ruleId, competenceDate } });
        await tx.transaction.create({ data: { householdId, createdBy: user.id, accountId: account.id, categoryId: category.id, type: "EXPENSE", description: "Internet mensal Demo", amount: "120", status: "PENDING", competenceDate, scheduledDate: new Date(addMonthsClamped("2027-01-10", index)), recurringOccurrenceId: occurrence.id } });
      }
    }
    if (!existingTransfer) await tx.transfer.create({ data: { id: transferId, householdId, createdBy: user.id, sourceAccountId: account.id, destinationAccountId: wallet.id, amount: "200", transferDate: new Date("2027-01-10"), competenceDate: new Date("2027-01-01"), description: "Transferência Demo" } });
  });
  console.info("Seed concluído: demo@estimeta.example. A senha é o valor local de SEED_PASSWORD.");
}
main().catch((error: unknown) => {
  if (error instanceof SeedConfigurationError) {
    console.error(`Seed não concluído. ${error.message}`);
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("Seed não concluído. Não foi possível conectar ao MySQL. Verifique DATABASE_URL e se o servidor está disponível.");
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) {
    console.error("Seed não concluído. O banco não possui a estrutura esperada. Execute npm.cmd run db:deploy.");
  } else {
    console.error("Seed não concluído. Ocorreu uma falha ao gravar os dados de desenvolvimento. Verifique a configuração e as permissões do banco.");
  }
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
