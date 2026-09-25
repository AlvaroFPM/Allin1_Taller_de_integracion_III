import axios from 'axios';
import { getAccessToken, removeAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de Respuestas (Response) para capturar 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Limpiar tokens de las cookies
      removeAuthTokens();

      // Limpiar estado global de Zustand
      useAuthStore.getState().clearAuth();

      // Redirigir al usuario al login si no esta en rutas publicas
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login?session=expired';
      }
    }
    return Promise.reject(error);
  },
);
