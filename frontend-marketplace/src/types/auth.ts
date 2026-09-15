import { z } from "zod";

// --- Esquemas de Validación Frontend (Zod) ---
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Ingresa un correo electrónico válido (ej: usuario@ejemplo.com)"),
  password: z.string().min(1, "La contraseña es requerida"),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// --- Entidades del Dominio ---
export interface User {
  id: string;
  email: string;
  fullName: string;
  kycVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

// --- DTOs para Comunicación con Backend Go / REST Gateway ---
export interface LoginRequestDTO {
  email: string;
  passwordHash: string;
}

export interface RegisterRequestDTO {
  email: string;
  passwordHash: string;
  fullName: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  user: User;
}