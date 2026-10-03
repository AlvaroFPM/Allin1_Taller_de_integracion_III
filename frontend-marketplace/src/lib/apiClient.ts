// Wrapper para mantener retrocompatibilidad con imports que usan 'apiClient' o 'axios'
import api from './axios';

export const apiClient = api;
export default api;
