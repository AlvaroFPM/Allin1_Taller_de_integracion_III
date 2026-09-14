"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginFormData } from "@/types/auth";

export interface LoginFormProps {
  onSuccess?: (data: LoginFormData) => void;
  sessionExpired?: boolean;
}

export function LoginForm({ onSuccess, sessionExpired = false }: LoginFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Simulamos petición asíncrona de autenticación
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitSuccess(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", "simulated_jwt_token_allin1");
    }
    onSuccess?.(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {/* Alerta de sesión expirada (proveniente de axios 401) */}
      {sessionExpired && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Tu sesión ha expirado. Por favor, ingresa tus credenciales nuevamente.</span>
        </div>
      )}

      {/* Alerta de Éxito de Validación */}
      {submitSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>¡Validación exitosa! Conectando a la cuenta...</span>
        </div>
      )}

      {/* Campo: Correo Electrónico */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-content-main">
          Correo electrónico <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <input
            type="email"
            placeholder="nombre@ejemplo.com"
            {...register("email")}
            className={`w-full h-10 pl-10 pr-3.5 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
              errors.email
                ? "border-red-500 ring-2 ring-red-500/10 focus:border-red-500"
                : "border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20"
            }`}
          />
        </div>
        {errors.email && (
          <p className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
            <span>●</span> {errors.email.message}
          </p>
        )}
      </div>

      {/* Campo: Contraseña */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-content-main">
          Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            {...register("password")}
            className={`w-full h-10 pl-10 pr-10 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
              errors.password
                ? "border-red-500 ring-2 ring-red-500/10 focus:border-red-500"
                : "border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20"
            }`}
          />
          {/* Botón para alternar visibilidad de contraseña */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-content-muted hover:text-content-main transition-colors cursor-pointer"
            aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
            <span>●</span> {errors.password.message}
          </p>
        )}
      </div>

      {/* Fila: Recordarme y Olvidé mi Contraseña */}
      <div className="flex items-center justify-between text-xs pt-1">
        <label className="flex items-center gap-2 text-content-muted cursor-pointer select-none">
          <input
            type="checkbox"
            {...register("rememberMe")}
            className="w-3.5 h-3.5 rounded border-border-base text-brand focus:ring-brand accent-brand cursor-pointer"
          />
          <span>Recordarme</span>
        </label>
        <Link
          href="/recuperar-contrasena"
          className="font-medium text-brand hover:text-brand-hover transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {/* Botón de Submit */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          isLoading={isSubmitting}
          className="font-bold shadow-md hover:shadow-lg transition-all"
        >
          Ingresar a mi cuenta →
        </Button>
      </div>
    </form>
  );
}
