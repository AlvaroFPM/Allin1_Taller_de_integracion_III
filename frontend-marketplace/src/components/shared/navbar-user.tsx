'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { NavbarUserDropdown } from './navbar-user-dropdown';
import type { UserSession, NavItem } from '@/types/navigation';
import type { User } from '@/types/auth';

const userNavItems: NavItem[] = [
  { label: 'Explorar', href: '/explorar' },
  { label: 'Soporte', href: '/soporte' },
  { label: 'Mi Perfil', href: '/perfil' },
];

function getInitials(name?: string, fallback = 'U'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export interface NavbarUserProps {
  user: UserSession | User;
  isMobileOpen?: boolean;
  onCloseMenu?: () => void;
  onLogout?: () => void;
}

export function NavbarUser({
  user,
  isMobileOpen: controlledMobileOpen,
  onCloseMenu,
  onLogout,
}: NavbarUserProps) {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [internalMobileOpen, setInternalMobileOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const isControlled = controlledMobileOpen !== undefined;
  const mobileOpen = isControlled ? controlledMobileOpen : internalMobileOpen;

  const closeMenu = React.useCallback(() => {
    if (isControlled) {
      onCloseMenu?.();
    } else {
      setInternalMobileOpen(false);
    }
  }, [isControlled, onCloseMenu]);

  const toggleMenu = React.useCallback(() => {
    if (isControlled) {
      if (mobileOpen) onCloseMenu?.();
    } else {
      setInternalMobileOpen((prev) => !prev);
    }
  }, [isControlled, mobileOpen, onCloseMenu]);

  const handleLogout = React.useCallback(() => {
    setIsDropdownOpen(false);
    closeMenu();
    clearAuth();
    onLogout?.();
    router.push('/');
  }, [clearAuth, onLogout, router, closeMenu]);

  const userInitials = (user as UserSession).initials || getInitials(user.name);

  // Cerrar dropdown al hacer clic fuera
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDropdownOpen]);

  // Cerrar con Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-base bg-surface-main/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo Allin1 */}
        <Link
          href="/"
          onClick={closeMenu}
          className="flex items-center gap-2.5 select-none group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-black text-sm tracking-tight shadow-xs transition-transform group-hover:scale-105">
            A1
          </div>
          <span className="font-black text-xl tracking-tight text-content-main">Allin1</span>
        </Link>

        {/* Buscador Rápido Central (Desktop) */}
        <div className="hidden lg:flex flex-1 max-w-md items-center">
          <div className="relative w-full flex items-center">
            <svg
              className="absolute left-3 w-4 h-4 text-content-muted pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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

        {/* Navegación Desktop */}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M12 4v16m8-8H4"
                  />
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
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userInitials
                )}
              </div>
            </button>

            <NavbarUserDropdown
              user={user}
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>

        {/* Botón Hamburguesa Móvil */}
        <button
          type="button"
          onClick={toggleMenu}
          className="flex md:hidden p-2 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base transition-colors"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
          aria-controls="user-mobile-menu"
        >
          <svg
            className="w-6 h-6 transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Menú Móvil Desplegable */}
      {mobileOpen && (
        <div
          id="user-mobile-menu"
          className="md:hidden border-b border-border-base bg-surface-main px-4 pt-3 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-3 p-2 bg-surface-base rounded-xl">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-content-main truncate">{user.name}</p>
              <p className="text-[11px] text-content-muted truncate">{user.email}</p>
            </div>
            <Badge variant="brand" size="sm">
              {user.role}
            </Badge>
          </div>

          <div className="flex flex-col space-y-1">
            {userNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="px-3 py-2 rounded-md text-sm font-medium text-content-main hover:bg-surface-base transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-border-base flex flex-col gap-2">
            <Link href="/publicar" onClick={closeMenu} className="w-full">
              <Button variant="outline" size="sm" fullWidth>
                + Publicar Solicitud
              </Button>
            </Link>
            <Button variant="danger" size="sm" fullWidth onClick={handleLogout}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
