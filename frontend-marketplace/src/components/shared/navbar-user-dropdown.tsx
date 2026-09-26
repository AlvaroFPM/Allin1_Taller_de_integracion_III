'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { UserSession } from '@/types/navigation';
import type { User } from '@/types/auth';

export interface NavbarUserDropdownProps {
  user: UserSession | User;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function NavbarUserDropdown({ user, isOpen, onClose, onLogout }: NavbarUserDropdownProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-main border border-border-base shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabecera del Usuario */}
      <div className="px-4 py-3 border-b border-border-base">
        <p className="text-sm font-bold text-content-main truncate">{user.name}</p>
        <p className="text-xs text-content-muted truncate">{user.email}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge variant="brand" size="sm">
            {user.role}
          </Badge>
          {user.isVerified && (
            <span className="text-[11px] text-brand font-medium">● Verificado</span>
          )}
        </div>
      </div>

      {/* Enlaces Rápidos */}
      <div className="py-1">
        <Link
          href="/perfil"
          onClick={onClose}
          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
        >
          <svg
            className="w-4 h-4 text-content-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Mi Perfil y Actividad
        </Link>
        <Link
          href="/perfil#billetera"
          onClick={onClose}
          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
        >
          <svg
            className="w-4 h-4 text-content-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          Billetera & Pagos Escrow
        </Link>
        <Link
          href="/soporte"
          onClick={onClose}
          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
        >
          <svg
            className="w-4 h-4 text-content-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Centro de Ayuda
        </Link>
      </div>

      {/* Botón Cerrar Sesión */}
      <div className="pt-1 border-t border-border-base">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
