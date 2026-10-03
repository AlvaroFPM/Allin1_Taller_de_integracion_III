import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * Formatea una fecha devuelta por Go (ISO 8601 o Date) a un texto legible.
 */
export function formatDate(date: string | Date | undefined | null, formatStr = 'PP'): string {
  if (!date) return '';

  const parsedDate = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(parsedDate)) {
    return '';
  }

  return format(parsedDate, formatStr, { locale: es });
}

/**
 * Alias para compatibilidad con llamadas existentes que usen formatDateFromGo
 */
export const formatDateFromGo = formatDate;
