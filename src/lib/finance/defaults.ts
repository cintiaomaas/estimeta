import type { TransactionType } from "@prisma/client";

export const defaultCategories: { name: string; type: TransactionType }[] = [
  ...["Salário", "Renda extra", "13º salário", "Férias", "Restituição", "Outros"].map((name) => ({ name, type: "INCOME" as const })),
  ...["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Internet", "Telefone", "Lazer", "Cuidados pessoais", "Impostos", "Outros"].map((name) => ({ name, type: "EXPENSE" as const })),
];
