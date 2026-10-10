/** One instance per authenticated layout. Never persisted or shared on the server. */
export class CatalogCache {
  private entries = new Map<string, { expires: number; promise: Promise<unknown> }>();

  constructor(private readonly ttl = 30_000, private readonly now = Date.now) {}

  clear() { this.entries.clear(); }

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expires > this.now()) return existing.promise as Promise<T>;
    const entry = { expires: Infinity, promise: Promise.resolve().then(load) };
    this.entries.set(key, entry);
    entry.promise.then(() => { entry.expires = this.now() + this.ttl; }, () => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry.promise;
  }
}
