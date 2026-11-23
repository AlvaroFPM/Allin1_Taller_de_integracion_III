import axios from 'axios';
import { apiClient } from '@/lib/apiClient';
import { setAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';
import { mapProfileToUser, mapProfileUpdate, type ProfileResponse } from '@/lib/mappers/auth';
import type { EditProfileFormData } from '@/types/profile';

export const getPrivateProfile = async (signal?: AbortSignal) => {
  const { data } = await apiClient.get<ProfileResponse>('/v1/auth/profile', { signal });
  return data;
};

export const updatePrivateProfile = async (form: EditProfileFormData, habilidades: string) => {
  const { data } = await apiClient.put<ProfileResponse>(
    '/v1/auth/profile',
    mapProfileUpdate(form, habilidades),
  );
  return data;
};

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

export const getPublicProfile = async (
  userId: number,
  signal?: AbortSignal,
): Promise<PublicProfileData | null> => {
  try {
    const response = await apiClient.get<Record<string, unknown>>(`/v1/auth/profile/${userId}`, {
      signal,
      timeout: 3000,
    });
    const data = response.data;
    if (!data) return null;

    const rawId = data.userId ?? data.user_id ?? userId;
    const resolvedUserId = Number(rawId);
    if (!Number.isFinite(resolvedUserId)) return null;

    return {
      userId: resolvedUserId,
      firstName: String(data.firstName ?? data.first_name ?? ''),
      lastName: String(data.lastName ?? data.last_name ?? ''),
      bioExperiencia: (data.bioExperiencia ?? data.bio_experiencia ?? '') as string,
      habilidades: (data.habilidades ?? '') as string,
      ciudad: (data.ciudad ?? '') as string,
      region: (data.region ?? '') as string,
      fotoPerfilUrl: (data.fotoPerfilUrl ?? data.foto_perfil_url ?? '') as string,
      portadaUrl: (data.portadaUrl ?? data.portada_url ?? '') as string,
      rol: (data.rol ?? 'PROVEEDOR') as string,
    };
  } catch (error: unknown) {
    if (Boolean(axios.isCancel?.(error)) || signal?.aborted) {
      return null;
    }
    console.error(`Error al consultar perfil público del usuario ${userId}:`, error);
    return null;
  }
};
