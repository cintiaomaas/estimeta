import { requireUser } from "@/lib/auth/session";
import { Brand } from "@/components/ui/brand";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="app-layout"><a className="skip-link" href="#content">Ir para o conteúdo</a><aside className="sidebar"><Brand /><span className="nav-caption">SEU ESPAÇO</span><DesktopNavigation /><div className="sidebar-note"><span className="status-dot" /> Um começo com propósito<p>Seu futuro começa nas pequenas escolhas.</p></div><div className="sidebar-user"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Conta pessoal</small></div></div><LogoutButton /></aside><div className="main-area"><header className="app-header"><div className="desktop-header-label">Meu espaço <span>/</span> estimeta</div><div className="mobile-brand"><Brand /></div><details className="user-menu"><summary aria-label="Abrir menu do usuário"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-menu-name">{user.name.split(" ")[0]}</span></summary><div className="user-menu-panel"><p>{user.email}</p><LogoutButton /></div></details></header><main id="content" className="app-content">{children}</main><footer className="app-footer">Feito para o seu próximo passo.<span>estimeta</span></footer></div><MobileNavigation /></div>;
}

