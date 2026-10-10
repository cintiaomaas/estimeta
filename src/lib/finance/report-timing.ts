export type ReportStage = "snapshot" | "history" | "goals" | "planning" | "balances"
  | "pending" | "expense_categories" | "top_expenses" | "recent_transactions"
  | "available_years" | "annual_groups" | "annual_categories" | "annual_balances" | "wealth";

export type MeasureReport = <T>(stage: ReportStage, work: () => Promise<T>) => Promise<T>;

/** Services remain usable without HTTP instrumentation (tests, scripts). */
export const unmeasuredReport: MeasureReport = (_stage, work) => work();
