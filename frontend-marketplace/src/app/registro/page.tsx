'use client';

import * as React from 'react';
import Link from 'next/link';
import { RegisterCard } from '@/components/shared';

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 relative">
      {/* Botón flotante para regresar al home */}
      <div className="w-full max-w-5xl mb-4 text-left">
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

      {/* Tarjeta de registro split-screen */}
      <RegisterCard />
    </div>
  );
}
