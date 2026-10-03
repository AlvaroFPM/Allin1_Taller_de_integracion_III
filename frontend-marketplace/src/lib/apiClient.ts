// Wrapper para mantener retrocompatibilidad con imports que usan 'apiClient' o 'axios'
import api from './axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Habilita el envío de cookies entre cliente y servidor Go
});

// Interceptor de Peticiones (Request): Inyección centralizada del token JWT desde Cookies
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

// Interceptor de Respuestas (Response): Manejo de sesión expirada (401)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // 1. Limpiar tokens de las cookies mediante el helper unificado
      removeAuthTokens();

      // 2. Limpiar estado global en Zustand
      useAuthStore.getState().clearAuth();

      // 3. Redirigir al usuario si no está en una ruta pública de login
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login?session=expired';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
