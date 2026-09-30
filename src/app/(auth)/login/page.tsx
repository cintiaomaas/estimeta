import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";
export const metadata: Metadata = { title: "Entrar" };
export default function LoginPage() { return <><span className="eyebrow">BOM TER VOCÊ POR AQUI</span><h1>Seu próximo passo<br />começa aqui.</h1><p className="page-description">Entre na sua conta e sinta-se em casa.</p><LoginForm /></>; }
