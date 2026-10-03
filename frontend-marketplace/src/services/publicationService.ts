import axios from 'axios';
import api from '@/lib/axios';
import type { PublicationCategory } from '@/types/publication';
import { formatRelativeTime, ProtobufTimestamp } from '@/lib/dateUtils';

export interface CatalogPublication {
  id: number;
  title: string;
  description: string;
  price: number;
  currency: string;
  type: string;
  sellerId: number;
  sellerName?: string;
  categoryId: number;
  createdAtRelative: string;
}

export interface ListPublicationsParams {
  page?: number;
  limit?: number;
  categoriaId?: number;
  query?: string;
  tipoServicio?: 'OFERTA' | 'DEMANDA';
}

// Interfaces internas para mapear las respuestas raw del backend Go en Protobuf
interface RawCategory {
  idCategoria: number;
  nombre: string;
  slug: string;
  iconoUrl?: string;
}

interface RawPublication {
  idPublicacion: number;
  titulo: string;
  descripcion: string;
  precioBase: number;
  tipoServicio: string;
  idUsuarioVendedor: number;
  categoriaId: number;
  fechaCreacion?: ProtobufTimestamp | string;
  createdAt?: ProtobufTimestamp | string;
}

// URL base para el microservicio de Catálogo
const CATALOG_API_URL = process.env.NEXT_PUBLIC_CATALOG_API_URL || 'http://localhost:8082';

export const publicationService = {
  /**
   * Obtiene la lista de categorías reales desde el backend
   */
  getCategories: async (): Promise<PublicationCategory[]> => {
    try {
      const response = await api.get(`${CATALOG_API_URL}/v1/categories`);

      if (response.data && response.data.categories) {
        return response.data.categories.map((c: RawCategory) => ({
          id: c.idCategoria,
          nombre: c.nombre,
          slug: c.slug,
          icono: c.iconoUrl || '📌',
        }));
      }
      return [];
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching categories:', error.response?.data || error.message);
      } else {
        console.error('Error fetching categories:', error);
      }
      return [];
    }
  },

  /**
   * Obtiene la lista paginada de publicaciones formateando la fecha de creación
   */
  getPublications: async (
    params: ListPublicationsParams = {},
  ): Promise<{ publications: CatalogPublication[]; total: number }> => {
    try {
      const response = await api.get(`${CATALOG_API_URL}/v1/publications`, { params });

      if (response.data && response.data.publications) {
        const publications = response.data.publications.map((p: RawPublication) => {
          const rawDate = p.fechaCreacion || p.createdAt;

          return {
            id: p.idPublicacion,
            title: p.titulo,
            description: p.descripcion,
            price: p.precioBase,
            currency: 'CLP',
            type: p.tipoServicio,
            sellerId: p.idUsuarioVendedor,
            categoryId: p.categoriaId,
            createdAtRelative: formatRelativeTime(rawDate),
          };
        });

        return {
          publications,
          total: response.data.totalRecords || publications.length,
        };
      }
      return { publications: [], total: 0 };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching publications:', error.response?.data || error.message);
      } else {
        console.error('Error fetching publications:', error);
      }
      return { publications: [], total: 0 };
    }
  },

  /**
   * Crea una nueva publicación
   */
  createPublication: async (
    data: Omit<CatalogPublication, 'id' | 'createdAtRelative'>,
  ): Promise<CatalogPublication | null> => {
    try {
      const mapTipoServicio = (tipo: string) => {
        if (tipo === 'TRABAJO' || tipo === 'DEMANDA') return 'DEMANDA';
        return 'OFERTA';
      };

      const payload = {
        id_usuario_vendedor: data.sellerId,
        categoria_id: data.categoryId,
        titulo: data.title,
        descripcion: data.description,
        tipo_servicio: mapTipoServicio(data.type),
        precio_base: data.price,
        ciudad: 'Santiago',
        region: 'RM',
      };

      const response = await api.post(`${CATALOG_API_URL}/v1/publications`, payload);

      if (response.data && response.data.publication) {
        const p: RawPublication = response.data.publication;
        const rawDate = p.fechaCreacion || p.createdAt;

        return {
          id: p.idPublicacion,
          title: p.titulo,
          description: p.descripcion,
          price: p.precioBase,
          currency: 'CLP',
          type: p.tipoServicio,
          sellerId: p.idUsuarioVendedor,
          categoryId: p.categoriaId,
          createdAtRelative: formatRelativeTime(rawDate),
        };
      }
      return null;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error creating publication:', error.response?.data || error.message);
      } else {
        console.error('Error creating publication:', error);
      }
      throw error;
    }
  },
};
