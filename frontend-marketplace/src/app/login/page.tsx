'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoginCard } from '@/components/shared';

function LoginContent() {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('expired') === 'true';

  return <LoginCard sessionExpired={sessionExpired} />;
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 relative">
      {/* Botón flotante para regresar al home */}
      <div className="w-full max-w-4xl mb-4 text-left">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-muted hover:text-brand transition-colors select-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Volver al inicio</span>
        </Link>
      </div>

      {/* Tarjeta de autenticación envuelta en Suspense */}
      <React.Suspense
        fallback={
          <div className="w-full max-w-4xl min-h-96 bg-surface-main rounded-3xl border border-border-base animate-pulse flex items-center justify-center text-content-muted text-sm">
            Cargando inicio de sesión...
          </div>
        }
      >
        <LoginContent />
      </React.Suspense>
    </div>
  );
}
