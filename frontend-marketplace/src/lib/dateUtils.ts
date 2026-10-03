import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * Convierte fechas crudas de Go/ISO ("2026-03-29T14:00:00Z") a tiempo relativo ("Hace 2 horas").
 */
export function formatRelativeTime(date?: string | Date | null): string {
  if (!date) return 'Reciente';

  const parsedDate = typeof date === 'string' ? parseISO(date) : date;

  // Validación para evitar que date-fns lance un RangeError si la fecha viene corrupta
  if (!isValid(parsedDate)) {
    return 'Reciente';
  }

  return formatDistanceToNow(parsedDate, { addSuffix: true, locale: es });
}

/**
 * Formatea una fecha devuelta por Go a un texto en español estándar (ej: "12 oct. 2026").
 */
export function formatDate(date: string | Date | undefined | null, formatStr = 'PP'): string {
  if (!date) return '';

  const parsedDate = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(parsedDate)) {
    return '';
  }

  return format(parsedDate, formatStr, { locale: es });
}

// Alias para mantener compatibilidad con llamadas previas del proyecto
export const formatDateFromGo = formatDate;
