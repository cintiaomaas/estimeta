"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="fallback"><h1>Algo não saiu como esperado.</h1><p>Tente novamente em alguns instantes.</p><button className="button primary" onClick={reset}>Tentar novamente</button></main>; }
