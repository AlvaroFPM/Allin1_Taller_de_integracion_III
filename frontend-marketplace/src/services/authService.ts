import { apiClient } from '@/lib/apiClient';
import { LoginRequestDTO, RegisterRequestDTO, AuthResponseDTO } from '@/types/auth';
import { setAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';

export const loginUser = async (data: LoginRequestDTO): Promise<AuthResponseDTO> => {
  const response = await apiClient.post<AuthResponseDTO>('/auth/login', data);
  const { accessToken, refreshToken, user } = response.data;
  
  // Guardar tokens en cookies y actualizar estado global
  setAuthTokens(accessToken, refreshToken);
  useAuthStore.getState().setAuth(user, accessToken);
  
  return response.data;
};

export const registerUser = async (data: RegisterRequestDTO): Promise<AuthResponseDTO> => {
  const response = await apiClient.post<AuthResponseDTO>('/auth/register', data);
  const { accessToken, refreshToken, user } = response.data;
  
  setAuthTokens(accessToken, refreshToken);
  useAuthStore.getState().setAuth(user, accessToken);
  
  return response.data;
};