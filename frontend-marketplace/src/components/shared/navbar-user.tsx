"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserSession, NavItem } from "@/types/navigation";

const userNavItems: NavItem[] = [
  { label: "Bolsa de Trabajos", href: "/#trabajos" },
  { label: "Artículos", href: "/#marketplace" },
  { label: "Soporte", href: "/soporte" },
  { label: "Mi Perfil", href: "/perfil" },
];

export interface NavbarUserProps {
  user: UserSession;
  onLogout?: () => void;
}

export function NavbarUser({ user, onLogout }: NavbarUserProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isDropdownOpen]);

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

        {/* Navegación Desktop con Mi Perfil */}
        <nav className="hidden md:flex items-center gap-1">
          {userNavItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-3.5 py-1.5 text-sm font-medium text-content-muted hover:text-content-main hover:bg-surface-base rounded-lg transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Acciones Derecha (Publicar Solicitud + Avatar con Dropdown) */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <Link href="/publicar">
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Publicar Solicitud
            </Button>
          </Link>

          {/* Menú Desplegable de Usuario */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-brand/30 transition-all cursor-pointer select-none"
              aria-expanded={isDropdownOpen}
              aria-label="Menú de cuenta de usuario"
            >
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user.initials || "JP"}
              </div>
            </button>

            {/* Panel Dropdown Flotante */}
            {isDropdownOpen && (
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
                    <span className="text-[11px] text-brand font-medium">● Verificado</span>
                  </div>
                </div>

                {/* Enlaces Rápidos */}
                <div className="py-1">
                  <Link
                    href="/perfil"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
                  >
                    <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Mi Perfil y Actividad
                  </Link>
                  <Link
                    href="/perfil#billetera"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
                  >
                    <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Billetera & Pagos Escrow
                  </Link>
                  <Link
                    href="/soporte"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-content-main hover:bg-surface-base transition-colors"
                  >
                    <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Centro de Ayuda
                  </Link>
                </div>

                {/* Botón Cerrar Sesión */}
                <div className="pt-1 border-t border-border-base">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón Móvil */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="md:hidden p-2 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base"
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

      {/* Menú Móvil */}
      {isMobileOpen && (
        <div className="md:hidden border-b border-border-base bg-surface-main px-4 pt-3 pb-5 space-y-3">
          <div className="flex items-center gap-3 p-2 bg-surface-base rounded-xl">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs">
              {user.initials || "JP"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-content-main truncate">{user.name}</p>
              <p className="text-[11px] text-content-muted truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            {userNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium text-content-main hover:bg-surface-base"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-border-base flex flex-col gap-2">
            <Link href="/publicar" onClick={() => setIsMobileOpen(false)}>
              <Button variant="outline" size="sm" fullWidth>
                + Publicar Solicitud
              </Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={() => {
                setIsMobileOpen(false);
                onLogout?.();
              }}
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
