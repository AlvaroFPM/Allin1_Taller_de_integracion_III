import { z } from 'zod';

// --- Esquemas de Validación Frontend (Zod) ---
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido (ej: usuario@ejemplo.com)'),
  password: z.string().min(1, 'La contraseña es requerida'),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;


export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'El nombre es requerido')
      .min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z
      .string()
      .min(1, 'El apellido es requerido')
      .min(2, 'El apellido debe tener al menos 2 caracteres'),
    rut: z
      .string()
      .min(1, 'El RUT es requerido')
      .regex(/^[0-9]+-[0-9kK]{1}$/, 'Formato de RUT inválido (ej: 12345678-K)'),
    phone: z
      .string()
      .min(1, 'El número telefónico es requerido')
      .regex(/^\+?[0-9\s-]{8,15}$/, 'Ingresa un número telefónico válido (ej: +56 9 1234 5678)'),
    email: z
      .string()
      .min(1, 'El correo electrónico es requerido')
      .email('Ingresa un correo electrónico válido (ej: usuario@ejemplo.com)'),
    password: z
      .string()
      .min(1, 'La contraseña es requerida')
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(64, 'La contraseña no puede superar 64 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
      .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número')
      .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (ej: @#$%)'),
    confirmPassword: z.string().min(1, 'Debes confirmar tu contraseña'),
    terms: z.boolean().refine((val) => val === true, {
      message: 'Debes aceptar los Términos y Condiciones',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
