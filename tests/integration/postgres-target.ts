import assert from "node:assert/strict";
// This guard belongs to destructive fixture tests only, never to application services.
assert.notEqual(process.env.NODE_ENV, "production");
assert.equal(process.env.ESTIMETA_INTEGRATION_TARGET, "estimeta-migration-test-01");
const target = new URL(process.env.DATABASE_URL ?? "");
assert.ok(target.protocol === "postgresql:" || target.protocol === "postgres:");
assert.equal(target.hostname, process.env.ESTIMETA_INTEGRATION_HOST);
