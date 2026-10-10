"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep the chart's reserved height in its parent to avoid layout shifts. */
export function DeferredChart({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} style={{ height: "100%", minWidth: 0 }}>{visible ? children : <span role="status">Carregando gráfico…</span>}</div>;
}
