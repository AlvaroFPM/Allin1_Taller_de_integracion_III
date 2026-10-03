import axios from 'axios';
import Cookies from 'js-cookie';
import { getAccessToken, removeAuthTokens } from '@/lib/authCookies';
import { useAuthStore } from '@/store/useAuthStore';

// URL base con fallback para entornos de desarrollo y microservicios
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CATALOG_API_URL ||
  'http://localhost:8080/api/v1';

// Instancia única HTTP configurada para enviar cookies de sesión (withCredentials)
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Peticiones: Inyecta el Bearer Token desde Cookies o LocalStorage
api.interceptors.request.use(
  (config) => {
    const token =
      getAccessToken() ||
      Cookies.get('auth_token') ||
      (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de Respuestas: Limpia sesión y Zustand ante errores 401 (no autorizado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar cookies y persistencia local
      removeAuthTokens();
      Cookies.remove('auth_token');

      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        // Resetear estado global de autenticación
        useAuthStore.getState().clearAuth();

        // Redirigir al login si el usuario está en una ruta protegida
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?session=expired';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
