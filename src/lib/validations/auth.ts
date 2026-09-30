import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.").max(191));
export const passwordSchema = z.string().min(10, "Use pelo menos 10 caracteres.")
  .regex(/[a-zA-Z]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Use no máximo 72 bytes na senha.");
export const loginSchema = z.object({ email, password: z.string().min(1, "Informe sua senha.").max(72) });
export const registerSchema = z.object({ name: z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(100), email, password: passwordSchema });
export const registerFormSchema = registerSchema.extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { message: "As senhas precisam ser iguais.", path: ["confirmPassword"] });
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
