type FailureStage = "api" | "accounts.auth" | "accounts.data" | "diagnostic.reference" | "balances.query" | "balances.quotes" | "balances.serialize";
const stages = new WeakMap<object, FailureStage>();

export async function failureStage<T>(stage: FailureStage, work: () => T | Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error !== null && typeof error === "object" && !stages.has(error)) stages.set(error, stage);
    throw error;
  }
}

// Names are mapped through a closed allowlist, never emitted verbatim. This also
// recognizes errors created by a second runtime instance (Next bundling/HMR).
const failureTypes: Record<string, string> = {
  PrismaClientKnownRequestError: "prisma_known", PrismaClientUnknownRequestError: "prisma_unknown",
  PrismaClientValidationError: "prisma_validation", PrismaClientInitializationError: "prisma_initialization",
  PrismaClientRustPanicError: "prisma_panic", TypeError: "type_error", RangeError: "range_error",
  Error: "error", AppError: "app_error",
};
function property(value: unknown, key: string): unknown {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
  try { return Reflect.get(value, key); } catch { return undefined; }
}
// Never emit message, stack, SQL, parameters or metadata text.
export function safeFailure(error: unknown) {
  const stage = error !== null && typeof error === "object" ? stages.get(error) ?? "api" : "api";
  const errorName = property(error, "name");
  const constructorName = property(property(error, "constructor"), "name");
  const name = errorName === "Error" && constructorName === "AppError" ? "AppError" : errorName;
  const type = typeof name === "string" && Object.hasOwn(failureTypes, name) ? failureTypes[name] : "unknown";
  const prismaError = type.startsWith("prisma_");
  const code = prismaError || type === "app_error" ? property(error, "code") ?? property(error, "errorCode") : undefined;
  const databaseCode = prismaError ? property(property(error, "meta"), "code") : undefined;
  // Inspect only fixed validation markers; never emit the message or captures.
  const message = type === "prisma_validation" ? property(error, "message") : undefined;
  const validationReason = typeof message !== "string" ? undefined
    : message.includes("is a tag function") ? "raw_api_argument"
    : message.includes("Argument `query` is missing") ? "raw_query_missing"
    : message.includes("Expected String") ? "expected_string"
    : message.includes("Invalid value for argument") ? "invalid_argument"
    : message.includes("Invalid Date") ? "invalid_date" : "unclassified_validation";
  return { stage, type, code: typeof code === "string" && /^P\d{4}$/.test(code) ? code : "UNKNOWN",
    ...(typeof databaseCode === "string" && /^[0-9A-Z]{5}$/.test(databaseCode) ? { databaseCode } : {}),
    ...(validationReason ? { validationReason } : {}) };
}
