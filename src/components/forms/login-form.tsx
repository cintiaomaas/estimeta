"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { clearPushOnLogout } from "@/lib/push/browser";
import { Field } from "@/components/ui/field";
export function LoginForm({ destination = "/dashboard" }: { destination?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  async function submit(data: LoginInput) {
    setError("");
    try {
      await clearPushOnLogout();
      const result = await signIn("credentials", { ...data, redirect: false });
      if (result?.error) { setError(result.error === "CredentialsSignin" ? "E-mail ou senha inválidos." : "Não foi possível entrar. Tente novamente."); return; }
      setSuccess(true); router.replace(destination); router.refresh();
    } catch { setError("Não foi possível conectar. Tente novamente."); }
  }
  return <form onSubmit={handleSubmit(submit)} noValidate className="form-stack">
    <Field id="email" label="E-mail" type="email" autoComplete="email" placeholder="voce@exemplo.com" error={errors.email?.message} {...register("email")} />
    <Field id="password" label="Senha" type="password" autoComplete="current-password" placeholder="Sua senha" error={errors.password?.message} {...register("password")} />
    <Link href="/esqueci-senha" className="forgot-link">Esqueci minha senha</Link>
    {error && <p className="alert error" role="alert">{error}</p>}
    {success && <p className="alert" role="status">Tudo certo! Abrindo seu espaço…</p>}
    <button className="button primary" disabled={isSubmitting || success}>{isSubmitting ? <LoaderCircle className="spin" size={18} /> : null}{isSubmitting ? "Entrando…" : "Entrar"}<ArrowRight size={18} aria-hidden="true" /></button>
    <p className="form-footer">Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></p>
  </form>;
}
