export type PublicationType = 'TRABAJO' | 'SERVICIO' | 'ARTICULO';

export interface PublicationCategory {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
}

export interface CreatePublicationFormState {
  tipo: PublicationType;
  titulo: string;
  categoriaId: number | string;
  descripcion: string;
  ubicacion: string;
  moneda: string;
  precioBase: number | string;
}

export const CATEGORIAS_DISPONIBLES: PublicationCategory[] = [
  { id: 1, nombre: 'Flete & Mudanza', slug: 'fletes', icono: '🚚' },
  { id: 2, nombre: 'Pedir Comida', slug: 'comida', icono: '🍔' },
  { id: 3, nombre: 'Gasfitería Urgente', slug: 'gasfiteria', icono: '🔧' },
  { id: 4, nombre: 'Viaje / Auto', slug: 'transporte', icono: '🚗' },
  { id: 5, nombre: 'Electricista SEC', slug: 'electricidad', icono: '⚡' },
  { id: 6, nombre: 'Abogado / Trámites', slug: 'legal', icono: '⚖️' },
  { id: 7, nombre: 'Reparto Express', slug: 'delivery', icono: '🛵' },
  { id: 8, nombre: 'Aseo Hogar', slug: 'limpieza', icono: '🧹' },
  { id: 9, nombre: 'Comprar / Vender Artículos', slug: 'articulos', icono: '🛍️' },
  { id: 10, nombre: 'Paseo de Perros', slug: 'mascotas', icono: '🐕' },
  { id: 11, nombre: 'Pintor de Casas', slug: 'pintura', icono: '🎨' },
  { id: 12, nombre: 'Soporte Técnico PC', slug: 'computacion', icono: '💻' },
  { id: 13, nombre: 'Clases Particulares', slug: 'clases', icono: '📚' },
];

export const COMUNAS_DISPONIBLES = [
  'Providencia',
  'Las Condes',
  'Santiago Centro',
  'Ñuñoa',
  'La Florida',
  'Maipú',
  'Vitacura',
  'Lo Barnechea',
  'San Miguel',
  'Peñalolén',
  'Viña del Mar',
  'Valparaíso',
  'Concepción',
];
