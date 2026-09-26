'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NavbarGuest } from './navbar-guest';
import { NavbarUser } from './navbar-user';
import type { UserSession } from '@/types/navigation';
import type { User } from '@/types/auth';

export interface NavbarProps {
  user?: UserSession | User | null;
  onLogout?: () => void;
}

export function Navbar({ user, onLogout }: NavbarProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authUser = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // Permite sobreescribir el usuario vía props (para previews o testing)
  // o utiliza el estado reactivo del store global
  const currentUser = user !== undefined ? user : isAuthenticated && authUser ? authUser : null;

  const handleLogout = React.useCallback(() => {
    clearAuth();
    onLogout?.();
    router.push('/');
  }, [clearAuth, onLogout, router]);

  if (!currentUser) {
    return <NavbarGuest />;
  }

  return <NavbarUser user={currentUser} onLogout={handleLogout} />;
}
