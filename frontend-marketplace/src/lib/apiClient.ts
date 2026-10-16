// Wrapper para mantener retrocompatibilidad con imports que usan 'apiClient' o 'axios'
import { apiClient, api } from './axios';

export { apiClient, api };
export default apiClient;
