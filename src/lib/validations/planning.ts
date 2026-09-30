import { z } from "zod";
const percent = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Use um percentual com até duas casas decimais.").refine((v) => Number(v) > 0 && Number(v) <= 100, "O percentual deve ser maior que zero e no máximo 100%.");
export const percentUnits = (v: string) => { const [whole, part = ""] = v.split("."); return Number(whole) * 100 + Number(part.padEnd(2, "0")); };
export const planningSchema = z.object({
  revision: z.number().int().min(0), enabled: z.boolean(), incomeSource: z.enum(["REALIZED", "MANUAL"]),
  referenceIncome: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, "Informe uma renda válida, com até duas casas decimais."),
  groups: z.array(z.object({
    name: z.string().trim().min(1, "Informe o nome do grupo.").max(100),
    percentage: percent, alertPercentage: percent, active: z.boolean(),
    categoryIds: z.array(z.uuid()).max(500),
  }).strict()).max(50, "Utilize até 50 grupos."),
}).strict().superRefine((data, ctx) => {
  if (data.incomeSource === "MANUAL" && !/[1-9]/.test(data.referenceIncome)) ctx.addIssue({ code: "custom", message: "Informe uma renda de referência maior que zero.", path: ["referenceIncome"] });
  if (data.groups.filter((g) => g.active).reduce((sum, g) => sum + percentUnits(g.percentage), 0) > 10000) ctx.addIssue({ code: "custom", message: "A soma dos grupos ativos não pode ultrapassar 100% da renda.", path: ["groups"] });
  const assigned = new Set<string>();
  for (const group of data.groups) {
    if (new Set(group.categoryIds).size !== group.categoryIds.length) ctx.addIssue({ code: "custom", message: "Uma categoria não pode ser repetida no mesmo grupo." });
    for (const id of group.categoryIds) if (group.active) {
      if (assigned.has(id)) ctx.addIssue({ code: "custom", message: "Uma categoria não pode pertencer a dois grupos ativos." });
      assigned.add(id);
    }
  }
});
export type PlanningInput = z.infer<typeof planningSchema>;
