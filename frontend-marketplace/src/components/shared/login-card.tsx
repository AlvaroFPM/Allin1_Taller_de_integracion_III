'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginForm } from './login-form';

export interface LoginCardProps {
  sessionExpired?: boolean;
  onSuccess?: () => void;
}

export function LoginCard({ sessionExpired = false, onSuccess }: LoginCardProps) {
  const router = useRouter();

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      // Flujo visual: Tras confirmación visual, redirige al home o panel principal
      setTimeout(() => {
        router.push('/');
      }, 1200);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-surface-main rounded-3xl shadow-xl border border-border-base overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-in fade-in zoom-in-95 duration-200">
      {/* Panel Izquierdo: Branding Allin1 (Oculto en móvil para máxima accesibilidad y foco) */}
      <div className="hidden md:flex flex-col justify-between p-10 lg:p-12 bg-linear-to-br from-[#0a5c36] via-[#0d684a] to-[#064326] text-white select-none">
        <div>
          <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            All in 1
          </span>
        </div>

        <div className="space-y-4 my-auto py-12">
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
            ¡Bienvenido de vuelta!
          </h1>
          <p className="text-emerald-100/90 text-sm lg:text-base leading-relaxed">
            Tu marketplace integral de productos y servicios. Conéctate para continuar gestionando
            pedidos, logística y requerimientos al instante.
          </p>
        </div>

        <div className="pt-6 border-t border-emerald-600/40 flex items-center justify-between text-[11px] text-emerald-200/75">
          <span>© 2026 All in 1 Marketplace</span>
          <span>Conexión Oferta & Demanda</span>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Inicio de Sesión */}
      <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
        {/* Cabecera del formulario */}
        <div className="mb-6 text-left">
          <div className="md:hidden mb-3">
            <span className="text-lg font-black text-brand">All in 1</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-content-main tracking-tight">
            Iniciar Sesión
          </h2>
          <p className="text-xs sm:text-sm text-content-muted mt-1.5">
            Ingresa tus credenciales para acceder.
          </p>
        </div>

        {/* Botones de Autenticación Social (OAuth) */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            className="h-10 px-3 rounded-xl border border-border-base bg-surface-main text-content-main text-xs sm:text-sm font-semibold hover:bg-surface-base hover:border-border-base/80 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            onClick={() => alert('El inicio de sesión con Google estará disponible próximamente.')}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            className="h-10 px-3 rounded-xl border border-border-base bg-surface-main text-content-main text-xs sm:text-sm font-semibold hover:bg-surface-base hover:border-border-base/80 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            onClick={() => alert('El inicio de sesión con GitHub estará disponible próximamente.')}
          >
            <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>GitHub</span>
          </button>
        </div>

        {/* Divisor "O CON CORREO ELECTRÓNICO" */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-base" />
          </div>
          <span className="relative bg-surface-main px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-content-muted">
            O con correo electrónico
          </span>
        </div>

        {/* Formulario React Hook Form + Zod */}
        <LoginForm sessionExpired={sessionExpired} onSuccess={handleSuccess} />

        {/* Pie: Enlace a Registro */}
        <div className="mt-6 text-center text-xs text-content-muted">
          <span>¿Aún no tienes cuenta? </span>
          <Link
            href="/registro"
            className="font-bold text-brand hover:text-brand-hover hover:underline transition-colors"
          >
            Crear cuenta en All in 1
          </Link>
        </div>
      </div>
    </div>
  );
}
