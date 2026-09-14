import { z } from "zod";


export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Ingresa un correo electrónico válido (ej: usuario@ejemplo.com)"),
  password: z.string().min(1, "La contraseña es requerida"),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
