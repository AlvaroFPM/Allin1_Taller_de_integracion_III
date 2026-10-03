import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CATALOG_API_URL ||
  'http://localhost:8082';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar Token Bearer desde Cookie o LocalStorage
api.interceptors.request.use(
  (config) => {
    const token =
      Cookies.get('auth_token') ||
      (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor para captura de errores globales (ej: 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('auth_token');
      localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  },
);

export default api;
