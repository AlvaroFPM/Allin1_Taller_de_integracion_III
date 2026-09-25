'use client';

import * as React from 'react';
import { NavbarGuest } from './navbar-guest';
import { NavbarUser } from './navbar-user';
import type { UserSession } from '@/types/navigation';

export interface NavbarProps {
  user?: UserSession | null;
  onLogout?: () => void;
}

const mockUser: UserSession = {
  id: 1,
  name: 'Juan Andrés Pérez',
  email: 'juan.perez@allin1.cl',
  initials: 'JP',
  role: 'PROVEEDOR',
  isVerified: true,
};

export function Navbar({ user = null, onLogout }: NavbarProps) {
  const [mockSession, setMockSession] = React.useState<UserSession | null>(null);

  const currentUser = user ?? mockSession;

  if (!currentUser) {
    return <NavbarGuest onLogin={() => setMockSession(mockUser)} />;
  }

  return (
    <NavbarUser
      user={currentUser}
      onLogout={() => {
        setMockSession(null);
        onLogout?.();
      }}
    />
  );
}
