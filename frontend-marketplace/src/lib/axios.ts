import axios from 'axios';
import { getAccessToken, removeAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';

// URL base para el API Gateway o Microservicio principal
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Envío de cookies entre cliente y backend Go
});

// Interceptor de Request: Inyección centralizada de JWT en el header Authorization
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Interceptor de Response: Manejo automático de expiración de sesión (401)
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      // 1. Limpieza de tokens en cookies
      removeAuthTokens();

      // 2. Limpieza del estado global en Zustand
      useAuthStore.getState().clearAuth();

      // 3. Redirección limpia al login si aplica
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login?session=expired';
      }
    }
    return Promise.reject(error);
  },
);

export const api = apiClient;
export default apiClient;
