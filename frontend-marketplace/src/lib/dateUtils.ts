/**
 * Estructura estándar emitida por serialization en Go Protobuf para Timestamps.
 */
export interface ProtobufTimestamp {
  seconds?: number | string;
  nanos?: number;
}

export type ValidDateInput = string | number | Date | ProtobufTimestamp | null | undefined;

/**
 * Parsea distintas estructuras de fecha (Protobuf, ISO string, Timestamp unix) a un objeto Date de JS.
 */
export function parseProtobufOrIsoDate(input: ValidDateInput): Date | null {
  if (!input) return null;

  // Manejo de objeto Protobuf Timestamp { seconds, nanos }
  if (typeof input === 'object' && 'seconds' in input && input.seconds !== undefined) {
    const seconds = typeof input.seconds === 'string' ? parseInt(input.seconds, 10) : input.seconds;
    return new Date(seconds * 1000);
  }

  // Manejo de ISO Strings, Números (Milisegundos) o Date
  if (typeof input === 'string' || typeof input === 'number' || input instanceof Date) {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Retorna la diferencia de tiempo en formato relativo legible en español.
 */
export function formatRelativeTime(input: ValidDateInput): string {
  const date = parseProtobufOrIsoDate(input);
  if (!date) return 'Fecha desconocida';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Ayer';
  if (diffInDays < 30) return `Hace ${diffInDays} días`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `Hace ${diffInMonths} ${diffInMonths === 1 ? 'mes' : 'meses'}`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `Hace ${diffInYears} ${diffInYears === 1 ? 'año' : 'años'}`;
}
