import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export class NeonGuardError extends Error {}
export const fail = code => { throw new NeonGuardError(code); };
export const CONFIG_FILE = new URL("../../.env.neon-test.local", import.meta.url);
export const AUTHORIZED_TARGET = Object.freeze({ branchName: "estimeta-migration-test-01", database: "estimetadb", schema: "public" });
export function parseNeonConfig(values) {
  const keys = ["DATABASE_URL", "DATABASE_URL_POOLED", "NEON_PROJECT_ID", "NEON_TEST_BRANCH_ID",
    "NEON_TEST_BRANCH_NAME", "NEON_TEST_ENDPOINT_ID", "NEON_TEST_DATABASE", "NEON_TEST_SCHEMA", "NEON_API_KEY"];
  if (Object.keys(values).some(k => !keys.includes(k)) || keys.some(k => !values[k] || /REPLACE|PLACEHOLDER/.test(values[k]))) fail("NEON_CONFIG_INCOMPLETE");
  const { NEON_PROJECT_ID: project, NEON_TEST_BRANCH_ID: branch, NEON_TEST_BRANCH_NAME: branchName,
    NEON_TEST_ENDPOINT_ID: endpoint, NEON_TEST_DATABASE: database, NEON_TEST_SCHEMA: schema } = values;
  if (!/^[a-z0-9-]{1,60}$/.test(project) || !/^br-[a-z0-9-]+$/.test(branch) || !/^ep-[a-z0-9-]+$/.test(endpoint)) fail("NEON_ID_INVALID");
  if (branchName !== AUTHORIZED_TARGET.branchName) fail("NEON_TEST_BRANCH_NAME_REQUIRED");
  if (database !== AUTHORIZED_TARGET.database || schema !== AUTHORIZED_TARGET.schema) fail("NEON_DATABASE_SCHEMA_REJECTED");
  const urls = [values.DATABASE_URL, values.DATABASE_URL_POOLED].map((raw, i) => {
    let u;
    try { u = new URL(raw); } catch { fail("NEON_URL_INVALID"); }
    const hostPrefix = endpoint + (i ? "-pooler" : "") + ".";
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") fail("NEON_PROVIDER_REJECTED");
    if (!u.hostname.startsWith(hostPrefix) || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(u.hostname)
      || (u.port && u.port !== "5432") || u.hash || u.pathname !== `/${database}`) fail("NEON_TARGET_REJECTED");
    const params = [...u.searchParams.keys()];
    if (new Set(params).size !== params.length || params.some(k => !["sslmode", "schema", "channel_binding"].includes(k))
      || u.searchParams.get("sslmode") !== "require" || u.searchParams.get("schema") !== schema
      || (u.searchParams.has("channel_binding") && u.searchParams.get("channel_binding") !== "require")) fail("NEON_OPTIONS_REJECTED");
    try {
      const user = decodeURIComponent(u.username), password = decodeURIComponent(u.password);
      if (!user || !password || /[\x00-\x1f\x7f]/.test(user + password) || ["USER", "PASSWORD"].includes(user) || password === "PASSWORD") fail("NEON_CREDENTIALS_REQUIRED");
    } catch { fail("NEON_CREDENTIALS_REQUIRED"); }
    // These options are internal constants, not supplied by callers.
    u.searchParams.set("connection_limit", "1"); u.searchParams.set("connect_timeout", "15");
    u.searchParams.set("pool_timeout", "15");
    return u;
  });
  if (urls[1].hostname !== urls[0].hostname.replace(endpoint + ".", endpoint + "-pooler.")
    || urls[0].username !== urls[1].username || urls[0].password !== urls[1].password) fail("NEON_URL_PAIR_MISMATCH");
  return { project, branch, branchName, endpoint, database, schema, apiKey: values.NEON_API_KEY,
    direct: urls[0].href, pooled: urls[1].href, directHost: urls[0].hostname };
}
export function loadNeonConfig() {
  let values;
  try { values = parseEnv(readFileSync(CONFIG_FILE, "utf8")); } catch { fail("NEON_PRIVATE_FILE_UNREADABLE"); }
  // No process.env fallback; never load the application's .env or MySQL source.
  return parseNeonConfig(values);
}

export async function verifyBranch(config, fetcher = fetch) {
  // The shared database name is not proof of identity: pin the authorized tuple
  // and still verify the project's branch and endpoint through the control plane.
  if (config.branchName !== AUTHORIZED_TARGET.branchName || config.database !== AUTHORIZED_TARGET.database
    || config.schema !== AUTHORIZED_TARGET.schema) fail("NEON_AUTHORIZED_TARGET_REQUIRED");
  async function get(path) {
    const response = await fetcher(`https://console.neon.tech/api/v2/projects/${config.project}/${path}`, {
      method: "GET", headers: { Authorization: `Bearer ${config.apiKey}` }, redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // Only fixed status categories; never expose the response body or URL.
      const code = { 401: "NEON_API_AUTHENTICATION_FAILED", 403: "NEON_API_ACCESS_DENIED",
        404: "NEON_API_NOT_FOUND", 429: "NEON_API_RATE_LIMITED" }[response.status];
      fail(code ?? (response.status >= 500 && response.status <= 599 ? "NEON_API_UNAVAILABLE" : "NEON_API_VERIFICATION_FAILED"));
    }
    return response.json();
  }
  const { branch } = await get(`branches/${config.branch}`);
  if (branch?.id !== config.branch || branch?.project_id !== config.project || branch?.name !== config.branchName
    || branch?.default !== false || branch?.protected !== false) fail("NEON_BRANCH_REJECTED");
  const { endpoint } = await get(`endpoints/${config.endpoint}`);
  if (endpoint?.id !== config.endpoint || endpoint?.project_id !== config.project || endpoint?.branch_id !== config.branch
    || endpoint?.host !== config.directHost || endpoint?.type !== "read_write") fail("NEON_ENDPOINT_REJECTED");
  return { branchConfirmed: true };
}
