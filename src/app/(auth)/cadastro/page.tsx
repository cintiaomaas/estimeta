import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/register-form";
export const metadata: Metadata = { title: "Criar conta" };
export default function RegisterPage() { return <><span className="eyebrow">UM NOVO COMEÇO</span><h1>Vamos dar o<br />primeiro passo?</h1><p className="page-description">Crie sua conta e tenha um espaço só seu.</p><RegisterForm /></>; }
