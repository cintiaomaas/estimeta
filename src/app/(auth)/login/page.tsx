import { notificationLoginDestination } from "@/lib/notifications/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";
export const metadata: Metadata = { title: "Entrar" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; const destination = notificationLoginDestination(next); return <><span className="eyebrow">BOM TER VOCÊ POR AQUI</span><h1>Seu próximo passo<br />começa aqui.</h1><p className="page-description">Entre na sua conta e sinta-se em casa.</p><LoginForm destination={destination} /></>; }
