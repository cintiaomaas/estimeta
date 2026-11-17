import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import nextEnv from "@next/env";
import { loadNeonConfig, verifyBranch } from "./testing/neon-config.mjs";

// Test-only preflight. Never imports data, migrates schema, or configures the application.
nextEnv.loadEnvConfig(process.cwd(), true);
const target = loadNeonConfig();
await verifyBranch(target);
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const actual = new URL(process.env[key]);
  const expected = new URL(key === "DATABASE_URL" ? target.pooled : target.direct);
  if (actual.host !== expected.host || actual.pathname !== expected.pathname) throw new Error("Integration target mismatch");
}
const http = process.argv.includes("--http");
if (http && !["localhost", "127.0.0.1"].includes(new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000").hostname)) throw new Error("HTTP tests require loopback");
const files = readdirSync("tests/integration").filter(name => name.endsWith(http ? ".http.ts" : ".postgres.ts"));
// Load Prisma only after Next's environment precedence has been established.
const { fingerprint, assertPreserved } = await import("./postgres-data-fingerprint.mjs");
const before = await fingerprint();
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files.map(name => `tests/integration/${name}`)], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, NODE_ENV: "test", ESTIMETA_INTEGRATION_TARGET: target.branchName,
    ESTIMETA_INTEGRATION_HOST: new URL(target.pooled).hostname },
});
assertPreserved(before, await fingerprint());
process.exitCode = result.status ?? 1;
