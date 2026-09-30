import { PrismaClient } from "@prisma/client";
import { initializeFinancialDefaults } from "../src/services/financial-defaults";
const db = new PrismaClient();
initializeFinancialDefaults(db)
  .then((count) => console.info(`Categorias padrão inicializadas em ${count} espaço(s).`))
  .catch(() => { console.error("Não foi possível inicializar as categorias. Confira a conexão e aplique a migration financial_core."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
