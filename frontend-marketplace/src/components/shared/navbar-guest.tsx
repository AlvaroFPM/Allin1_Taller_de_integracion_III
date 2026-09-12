"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/types/navigation";

const guestNavItems: NavItem[] = [
  { label: "Bolsa de Trabajos", href: "/#trabajos" },
  { label: "Artículos", href: "/#marketplace" },
  { label: "Soporte", href: "/soporte" },
];

export interface NavbarGuestProps {
  onLogin?: () => void;
}

export function NavbarGuest({ onLogin }: NavbarGuestProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-base bg-surface-main/95 backdrop-blur-md shadow-xs">
      {/* Barra Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo Allin1 */}
        <Link href="/" className="flex items-center gap-2.5 select-none group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-black text-sm tracking-tight shadow-xs transition-transform group-hover:scale-105">
            A1
          </div>
          <span className="font-black text-xl tracking-tight text-content-main">
            Allin1
          </span>
        </Link>

        {/* Buscador Rápido Central */}
        <div className="hidden lg:flex flex-1 max-w-md items-center">
          <div className="relative w-full flex items-center">
            <svg className="absolute left-3 w-4 h-4 text-content-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar gasfitería, fletes, artículos..."
              className="w-full h-9.5 pl-9 pr-14 text-xs bg-surface-base border border-border-base rounded-full focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-content-muted"
            />
            <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-content-muted bg-surface-main border border-border-base rounded shadow-2xs pointer-events-none">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Navegación Desktop (Sin Mi Perfil) */}
        <nav className="hidden md:flex items-center gap-1">
          {guestNavItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-3.5 py-1.5 text-sm font-medium text-content-muted hover:text-content-main hover:bg-surface-base rounded-lg transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Acciones para Visitante (Ingresar / Registrarse) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Ingresar
            </Button>
          </Link>
          <Link href="/registro">
            <Button variant="primary" size="sm">
              Registrarse
            </Button>
          </Link>
        </div>

        {/* Botón Menú Móvil */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="md:hidden p-2 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Menú Móvil Desplegable */}
      {isMobileOpen && (
        <div className="md:hidden border-b border-border-base bg-surface-main px-4 pt-3 pb-6 space-y-4">
          <div className="flex flex-col space-y-1">
            {guestNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium text-content-main hover:bg-surface-base transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-border-base grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => {
                setIsMobileOpen(false);
                onLogin?.();
              }}
            >
              Ingresar
            </Button>
            <Link href="/registro" onClick={() => setIsMobileOpen(false)}>
              <Button variant="primary" size="sm" fullWidth>
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
