"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { registerFormSchema, type RegisterFormInput } from "@/lib/validations/auth";
import { Field } from "@/components/ui/field";
export function RegisterForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormInput>({ resolver: zodResolver(registerFormSchema) });
  async function submit({ name, email, password }: RegisterFormInput) {
    setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error?.message ?? "Não foi possível criar sua conta."); return; }
      setSuccess(true);
    } catch { setError("Não foi possível conectar. Tente novamente."); }
  }
  if (success) return <div className="success-state" role="status"><CheckCircle2 size={40} /><h2>Sua conta está pronta.</h2><p>Seu espaço pessoal foi criado. Entre para conhecer o estimeta.</p><Link className="button primary" href="/login">Ir para o login <ArrowRight size={18} /></Link></div>;
  return <form onSubmit={handleSubmit(submit)} noValidate className="form-stack">
    <Field id="name" label="Nome" autoComplete="name" placeholder="Como podemos chamar você?" error={errors.name?.message} {...register("name")} />
    <Field id="email" label="E-mail" type="email" autoComplete="email" placeholder="voce@exemplo.com" error={errors.email?.message} {...register("email")} />
    <Field id="password" label="Senha" type="password" autoComplete="new-password" hint="Pelo menos 10 caracteres, com letra e número. Máximo de 72 bytes." error={errors.password?.message} {...register("password")} />
    <Field id="confirmPassword" label="Confirmar senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
    {error && <p className="alert error" role="alert">{error}</p>}
    <button className="button primary" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="spin" size={18} />}{isSubmitting ? "Criando sua conta…" : "Criar minha conta"}<ArrowRight size={18} aria-hidden="true" /></button>
    <p className="form-footer">Já tem uma conta? <Link href="/login">Entrar</Link></p>
  </form>;
}
