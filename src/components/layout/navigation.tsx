"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, ChartColumnIncreasing, ArrowLeftRight, Wallet, Target, Settings, Plus, Ellipsis } from "lucide-react";
import { Modal } from "@/components/finance/controls";
const items = [
  { label: "Visão mensal", href: "/dashboard", icon: LayoutGrid },
  { label: "Resumo anual", href: "/resumo", icon: ChartColumnIncreasing },
  { label: "Transações", href: "/transacoes", icon: ArrowLeftRight },
  { label: "Contas", href: "/contas", icon: Wallet },
  { label: "Metas financeiras", href: "/metas", icon: Target },
];
export function DesktopNavigation() {
  const path = usePathname();
  return <nav aria-label="Menu principal" className="desktop-nav">{items.map(({ label, href, icon: Icon }) => href ? <Link key={label} href={href} aria-current={(path === href || (href === "/transacoes" && ["/receitas", "/despesas"].includes(path))) ? "page" : undefined}><Icon size={20} aria-hidden="true" />{label}</Link> : <button key={label} disabled><Icon size={20} aria-hidden="true" />{label}<span>Em breve</span></button>)}<Link className="settings-link" href="/configuracoes" aria-current={path.startsWith("/configuracoes") ? "page" : undefined}><Settings size={20} aria-hidden="true" />Configurações</Link></nav>;
}
export function MobileNavigation() {
  const path = usePathname();
  const [adding, setAdding] = useState(false);
  return <><nav aria-label="Menu principal no celular" className="mobile-nav"><Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined}><LayoutGrid size={21} />Visão mensal</Link><Link href="/transacoes" aria-current={["/transacoes", "/receitas", "/despesas"].includes(path) ? "page" : undefined}><ArrowLeftRight size={21} />Transações</Link><button className="add-button" onClick={() => setAdding(true)} aria-label="Adicionar lançamento"><span><Plus size={24} /></span>Adicionar</button><Link href="/contas" aria-current={path === "/contas" ? "page" : undefined}><Wallet size={21} />Contas</Link><Link href="/mais" aria-label="Mais opções do Estimeta" aria-current={path === "/mais" ? "page" : undefined}><Ellipsis size={21} />Mais</Link></nav>{adding && <Modal title="Adicionar lançamento" onClose={() => setAdding(false)}><div className="form-stack"><Link className="button primary" href="/transacoes?novo=INCOME" onClick={() => setAdding(false)}>Nova receita</Link><Link className="button secondary" href="/transacoes?novo=EXPENSE" onClick={() => setAdding(false)}>Nova despesa</Link></div></Modal>}</>;
}


