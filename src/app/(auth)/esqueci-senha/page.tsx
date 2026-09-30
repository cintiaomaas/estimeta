import Link from "next/link";
import { Mail } from "lucide-react";
export default function ForgotPasswordPage() { return <><Mail size={32} className="accent-icon" /><h1>Recuperar acesso</h1><p className="page-description">A recuperação de senha estará disponível em breve.</p><div className="alert">O envio de e-mails ainda não está disponível. Nenhuma solicitação de recuperação será enviada nesta fase.</div><Link className="button primary" href="/login">Voltar para o login</Link></>; }
