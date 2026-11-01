import { apiClient } from '@/lib/apiClient';
import { setAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';
import { mapProfileToUser, type ProfileResponse } from '@/lib/mappers/auth';

export const loginUser = async (data: { email: string; password: string }) => {
  const response = await apiClient.post<{ token: string; message: string }>('/v1/auth/login', data);
  const { token } = response.data;

  if (token) {
    setAuthTokens(token);
    const profileResponse = await apiClient.get<ProfileResponse>('/v1/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const realUser = mapProfileToUser(profileResponse.data);
    useAuthStore.getState().setAuth(realUser, token);
  }

  return response.data;
};

export const registerUser = async (data: Record<string, unknown>) => {
  const response = await apiClient.post<{ token: string; message: string; user_id?: number }>(
    '/v1/auth/register',
    data,
  );
  const { token } = response.data;

  if (token) {
    setAuthTokens(token);
    const profileResponse = await apiClient.get<ProfileResponse>('/v1/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const realUser = mapProfileToUser(profileResponse.data);
    useAuthStore.getState().setAuth(realUser, token);
  }

  return response.data;
};

export interface PublicProfileData {
  userId: number;
  firstName: string;
  lastName: string;
  bioExperiencia?: string;
  habilidades?: string;
  ciudad?: string;
  region?: string;
  fotoPerfilUrl?: string;
  portadaUrl?: string;
  rol?: string;
}

export const getPublicProfile = async (userId: number): Promise<PublicProfileData | null> => {
  try {
    const response = await apiClient.get<Record<string, unknown>>(`/v1/auth/profile/${userId}`);
    const data = response.data;
    if (!data) return null;

    return {
      userId: Number(data.userId ?? data.user_id ?? userId),
      firstName: String(data.firstName ?? data.first_name ?? 'Usuario'),
      lastName: String(data.lastName ?? data.last_name ?? ''),
      bioExperiencia: (data.bioExperiencia ?? data.bio_experiencia ?? '') as string,
      habilidades: (data.habilidades ?? '') as string,
      ciudad: (data.ciudad ?? '') as string,
      region: (data.region ?? '') as string,
      fotoPerfilUrl: (data.fotoPerfilUrl ?? data.foto_perfil_url ?? '') as string,
      portadaUrl: (data.portadaUrl ?? data.portada_url ?? '') as string,
      rol: (data.rol ?? 'PROVEEDOR') as string,
    };
  } catch (error) {
    console.error(`Error al consultar perfil público del usuario ${userId}:`, error);
    return null;
  }
};
