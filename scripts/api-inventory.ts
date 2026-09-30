import { mkdirSync, writeFileSync } from "node:fs";
import { openapi } from "../src/lib/api/openapi";
mkdirSync("docs/fase6", { recursive: true });
const rows = Object.entries(openapi.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => {
  const body = operation.requestBody as { content: Record<string, { schema: { $ref?: string } }> } | undefined;
  const bodyName = body ? Object.values(body.content).map(c => c.schema.$ref?.split("/").pop() ?? "Auth.js form").join(", ") : "—";
  const parameters = operation.parameters as { name: string; in: string }[];
  return `| ${method.toUpperCase()} | ${path} | ${operation.security.length ? "Sessão" : "Público/protocolo Auth.js"} | ${parameters.map(p => `${p.in}: ${p.name}`).join(", ") || "—"} | ${bodyName} | ${operation.summary} (schema em /api/openapi) | ${Object.keys(operation.responses).join(", ")} | ${operation.tags.join(", ")} |`;
}));
writeFileSync("docs/fase6/API.md", `# Inventário de APIs\n\nGerado do mesmo documento servido em /api/openapi. Atualizar: npm.cmd run docs:inventory. Schemas completos de resposta, corpos, enums e regras em [OpenAPI](./openapi.json). Swagger navegável em /docs. Auth.js delega ações ao catch-all; não foram criados handlers de autenticação duplicados.\n\n| Método | Endpoint | Autenticação | Parâmetros | Body | Resposta | Status | Entidade/tag |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`);
writeFileSync("docs/fase6/openapi.json", JSON.stringify(openapi, null, 2) + "\n");
console.info(`${rows.length} operações documentadas.`);
