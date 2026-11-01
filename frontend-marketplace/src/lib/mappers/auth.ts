import type { User } from '@/types/auth';

// JSON crudo que devuelve GET /v1/auth/profile (soporta camelCase y snake_case)
export interface ProfileResponse {
  userId?: string | number;
  user_id?: string | number;
  id?: string | number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  fotoPerfilUrl?: string;
  foto_perfil_url?: string;
  rol?: string;
}

const VALID_ROLES: User['role'][] = ['CLIENTE', 'PROVEEDOR', 'ADMIN'];

export function mapProfileToUser(profile: ProfileResponse): User {
  const rawId = profile.userId ?? profile.user_id ?? profile.id ?? 0;
  const firstName = profile.firstName ?? profile.first_name ?? '';
  const lastName = profile.lastName ?? profile.last_name ?? '';
  const rol = (profile.rol ?? '').toUpperCase() as User['role'];
  const foto = profile.fotoPerfilUrl ?? profile.foto_perfil_url;

  return {
    id: Number(rawId),
    name: `${firstName} ${lastName}`.trim() || 'Usuario Allin1',
    email: profile.email || '',
    role: VALID_ROLES.includes(rol) ? rol : 'CLIENTE',
    avatarUrl: foto || undefined,
    isVerified: true,
  };
}
