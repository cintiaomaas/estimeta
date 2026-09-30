import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Brand } from "@/components/ui/brand";
import { Leaf, ShieldCheck } from "lucide-react";
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return <main className="auth-layout"><section className="auth-story"><Brand /><div className="story-content"><span className="eyebrow">MENOS COMPLICAÇÃO. MAIS CLAREZA.</span><h1>Pequenos passos.<br />Novas <em>possibilidades.</em></h1><p>Um espaço para cuidar do que é seu e construir o que vem pela frente.</p><div className="growth-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="plant-symbol"><Leaf size={62} strokeWidth={1.2} /></div><div className="growth-caption">Cada começo tem seu valor.</div></div></div><div className="story-footer"><ShieldCheck size={18} /> Seu espaço pessoal e familiar</div></section><section className="auth-form-area"><div className="mobile-brand"><Brand /></div><div className="auth-form-card">{children}</div><p className="auth-bottom">estimeta · Um passo de cada vez.</p></section></main>;
}
