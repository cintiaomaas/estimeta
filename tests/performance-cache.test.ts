import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogCache } from "../src/lib/finance/catalog-cache";
import { requestTiming } from "../src/lib/api/timing";

test("catalogs deduplicate pending requests, expire and isolate layout sessions", async () => {
  let now = 0, calls = 0;
  const cache = new CatalogCache(30, () => now);
  const load = async () => ++calls;
  const first = cache.get("accounts", load);
  assert.equal(cache.get("accounts", load), first);
  assert.equal(await first, 1);
  now = 29;
  assert.equal(await cache.get("accounts", load), 1);
  now = 30;
  assert.equal(await cache.get("accounts", load), 2);
  assert.equal(await new CatalogCache().get("accounts", load), 3);
  cache.clear();
  assert.equal(await cache.get("accounts", load), 4);
});

test("invalidation prevents an older in-flight response from repopulating the cache", async () => {
  const cache = new CatalogCache();
  let resolve!: (value: string) => void;
  const old = cache.get("categories", () => new Promise<string>(done => { resolve = done; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.get("categories", async () => "new"), "new");
  resolve("old"); await old;
  assert.equal(await cache.get("categories", async () => "unexpected"), "new");
});

test("failed catalogs can be retried", async () => {
  const cache = new CatalogCache();
  await assert.rejects(cache.get("accounts", async () => { throw new Error("offline"); }));
  assert.equal(await cache.get("accounts", async () => "recovered"), "recovered");
});

test("server timing includes failed stages without changing response or leaking errors", async () => {
  const timing = requestTiming();
  await timing.measure("auth", async () => true);
  await assert.rejects(timing.measure("data", async () => { throw new Error("private SQL"); }));
  const response = timing.finish(Response.json({ error: "unavailable" }, { status: 500, headers: { "Cache-Control": "private, no-store" } }));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.match(response.headers.get("Server-Timing")!, /^auth;dur=\d+\.\d, data;dur=\d+\.\d, total;dur=\d+\.\d$/);
});
