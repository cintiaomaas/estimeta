"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CatalogCache } from "@/lib/finance/catalog-cache";
import { financialRequest, type AccountRecord, type CategoryRecord } from "@/lib/finance/client";

const CatalogContext = createContext<CatalogCache | null>(null);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(() => new CatalogCache());
  useEffect(() => {
    const clear = () => cache.clear();
    window.addEventListener("financial-catalogs-changed", clear);
    return () => { window.removeEventListener("financial-catalogs-changed", clear); cache.clear(); };
  }, [cache]);
  return <CatalogContext.Provider value={cache}>{children}</CatalogContext.Provider>;
}

export function useTransactionCatalogs() {
  const shared = useContext(CatalogContext);
  const [local] = useState(() => new CatalogCache());
  const cache = shared ?? local;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ accounts: AccountRecord[]; categories: CategoryRecord[]; loading: boolean; error: string }>({ accounts: [], categories: [], loading: true, error: "" });
  useEffect(() => {
    const changed = () => {
      cache.clear();
      setState(previous => ({ ...previous, loading: true, error: "" }));
      setRevision(v => v + 1);
    };
    window.addEventListener("financial-catalogs-changed", changed);
    return () => window.removeEventListener("financial-catalogs-changed", changed);
  }, [cache]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      cache.get("accounts", () => financialRequest<{ data: AccountRecord[] }>("/api/accounts")),
      cache.get("categories", () => financialRequest<{ data: CategoryRecord[] }>("/api/categories")),
    ]).then(([accounts, categories]) => {
      if (alive) setState({ accounts: accounts.data, categories: categories.data, loading: false, error: "" });
    }).catch((error: Error) => {
      if (alive) setState(previous => ({ ...previous, loading: false, error: error.message }));
    });
    return () => { alive = false; };
  }, [cache, revision]);
  function retry() {
    cache.clear();
    setState(previous => ({ ...previous, loading: true, error: "" }));
    setRevision(v => v + 1);
  }
  return { ...state, retry };
}
