import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/layout/logout-button";
export default async function Page() {
  await requireUser();
  return <><div className="page-heading"><h1>Mais opções</h1></div><nav className="panel more-menu" aria-label="Mais opções"><Link href="/metas">Metas financeiras</Link><Link href="/resumo">Resumo anual</Link><Link href="/receitas">Receitas</Link><Link href="/despesas">Despesas</Link><Link href="/recorrencias">Recorrências</Link><Link href="/transferencias">Transferências</Link><Link href="/configuracoes/categorias">Categorias</Link><Link href="/configuracoes">Configurações</Link><LogoutButton /></nav></>;
}

