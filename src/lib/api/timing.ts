/** Only durations and fixed stage names are returned, never SQL or user data. */
export function requestTiming() {
  const started = performance.now();
  const stages: string[] = [];
  return {
    async measure<T>(name: "auth" | "data", work: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try { return await work(); }
      finally { stages.push(`${name};dur=${(performance.now() - start).toFixed(1)}`); }
    },
    finish(response: Response) {
      response.headers.set("Server-Timing", [...stages, `total;dur=${(performance.now() - started).toFixed(1)}`].join(", "));
      return response;
    },
  };
}
