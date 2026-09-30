import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { openapi, schemas } from "../src/lib/api/openapi";
import manifest from "../src/app/manifest";

test("OpenAPI cobre exatamente os métodos financeiros e públicos implementados", () => {
  assert.deepEqual(JSON.parse(readFileSync("docs/fase6/openapi.json", "utf8")), JSON.parse(JSON.stringify(openapi)), "Atualize o snapshot com npm run docs:inventory.");
  const root = join(process.cwd(), "src/app/api");
  const actual = new Set<string>();
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === "route.ts" && !file.includes("[...nextauth]")) {
        const path = "/api/" + relative(root, dir).replaceAll("\\", "/").replace(/\[([^\]]+)\]/g, "{$1}");
        for (const match of readFileSync(file, "utf8").matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\(/g)) actual.add(`${match[1].toLowerCase()} ${path}`);
      }
    }
  }
  walk(root);
  const documented = new Set(Object.entries(openapi.paths).filter(([path]) => !path.startsWith("/api/auth/") || path === "/api/auth/register").flatMap(([path, methods]) => Object.keys(methods).map(method => `${method} ${path}`)));
  assert.deepEqual(documented, actual);
});

test("referências resolvem e schemas de entrada reutilizam Zod sem alterar dinheiro", () => {
  assert.equal(openapi.openapi, "3.1.0");
  for (const match of JSON.stringify(openapi).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g)) assert.ok(schemas[match[1]], match[1]);
  const props = schemas.TransactionRequest.properties as Record<string, { type?: string }>;
  assert.equal(props.amount.type, "string");
  assert.equal(schemas.TransactionRequest.additionalProperties, false);
  assert.equal(openapi.paths["/api/goals/{id}"].delete.responses["409"] !== undefined, true);
  assert.deepEqual((schemas.Pagination.properties as object), { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } });
  assert.equal(z.uuid().safeParse("11111111-1111-4111-8111-111111111111").success, true);
});

test("manifest PWA aponta para PNGs existentes com dimensões corretas", () => {
  const value = manifest();
  assert.equal(value.start_url, "/dashboard");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  for (const icon of [...value.icons!, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const png = readFileSync(join(process.cwd(), "public", icon.src));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
