import type { User } from '@/types/auth';

// JSON crudo que devuelve GET /v1/auth/profile (grpc-gateway, camelCase)
export interface ProfileResponse {
  userId: string | number;
  firstName: string;
  lastName: string;
  email: string;
  fotoPerfilUrl?: string;
  rol?: string;
}

const VALID_ROLES: User['role'][] = ['CLIENTE', 'PROVEEDOR', 'ADMIN'];

export function mapProfileToUser(profile: ProfileResponse): User {
  const rol = profile.rol?.toUpperCase() as User['role'];
  return {
    id: Number(profile.userId),
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    email: profile.email,
    role: VALID_ROLES.includes(rol) ? rol : 'CLIENTE',
    avatarUrl: profile.fotoPerfilUrl || undefined,
    isVerified: true,
  };
}