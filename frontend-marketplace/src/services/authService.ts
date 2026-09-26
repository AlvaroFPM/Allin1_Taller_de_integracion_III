import { apiClient } from '@/lib/apiClient';
import { setAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';

export const loginUser = async (data: Record<string, unknown>) => {
  const response = await apiClient.post('/auth/login', data);
  const { accessToken, refreshToken, user } = response.data;
  
  if (accessToken) {
    setAuthTokens(accessToken, refreshToken);
    useAuthStore.getState().setAuth(user, accessToken);
  }
  
  return response.data;
};

export const registerUser = async (data: Record<string, unknown>) => {
  const response = await apiClient.post('/auth/register', data);
  const { accessToken, refreshToken, user } = response.data;
  
  if (accessToken) {
    setAuthTokens(accessToken, refreshToken);
    useAuthStore.getState().setAuth(user, accessToken);
  }
  
  return response.data;
};