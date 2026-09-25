import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto numérico a Pesos Chilenos (CLP) (#57)
 * Ejemplo: 15000 -> "$15.000"
 */
export const formatCurrency = (amount: number): string => {
  if (isNaN(amount) || amount === null) return '$0';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Formatea una fecha a formato legible en español de Chile (#57)
 * Ejemplo: "2026-09-05" -> "5 de septiembre de 2026"
 */
export const formatDate = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Fecha inválida';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};
