import axios from 'axios';
import api from '@/lib/axios';
import type { PublicationCategory } from '@/types/publication';
import { formatRelativeTime, type ProtobufTimestamp } from '@/lib/dateUtils';

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

export interface ListPublicationsResult {
  publications: CatalogPublication[];
  total: number;
  totalPages?: number;
  currentPage?: number;
}

// Interfaces internas para mapear las respuestas del backend.
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
  precioBase: string | number;
  tipoServicio: string;
  idUsuarioVendedor: number;
  categoriaId: number;
  fechaCreacion?: ProtobufTimestamp | string;
  createdAt?: ProtobufTimestamp | string;
}

interface PublicationResponse {
  publication?: RawPublication;
}

interface ListPublicationsResponse {
  publications?: RawPublication[];
  meta?: {
    totalRecords?: string | number;
    totalPages?: number;
    currentPage?: number;
  };
}

// URL base para el microservicio de Catálogo.
const CATALOG_API_URL = process.env.NEXT_PUBLIC_CATALOG_API_URL || 'http://localhost:8082';

export const publicationService = {
  /**
   * Obtiene una publicación por su ID.
   * Los errores se propagan para que la página pueda mostrarlos.
   */
  getPublicationById: async (id: string, signal?: AbortSignal): Promise<CatalogPublication> => {
    const response = await api.get<PublicationResponse>(
      `${CATALOG_API_URL}/v1/publications/${encodeURIComponent(id)}`,
      { signal },
    );

    const publication = response.data.publication;

    if (!publication) {
      throw new Error('La API no devolvió la publicación.');
    }

    return {
      id: publication.idPublicacion,
      title: publication.titulo,
      description: publication.descripcion,
      price: Number(publication.precioBase),
      currency: 'CLP',
      type: publication.tipoServicio,
      sellerId: publication.idUsuarioVendedor,
      categoryId: publication.categoriaId,
      createdAtRelative: formatRelativeTime(publication.fechaCreacion || publication.createdAt),
    };
  },

  /**
   * Obtiene la lista de categorías reales desde el backend.
   */
  getCategories: async (): Promise<PublicationCategory[]> => {
    try {
      const response = await api.get<{ categories?: RawCategory[] }>(
        `${CATALOG_API_URL}/v1/categories`,
      );

      return (response.data.categories ?? []).map((category) => ({
        id: category.idCategoria,
        nombre: category.nombre,
        slug: category.slug,
        icono: category.iconoUrl || '📌',
      }));
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
   * Obtiene la lista paginada de publicaciones.
   */
  getPublications: async (params: ListPublicationsParams = {}): Promise<ListPublicationsResult> => {
    try {
      const response = await api.get<ListPublicationsResponse>(
        `${CATALOG_API_URL}/v1/publications`,
        { params },
      );

      if (response.data.publications) {
        const publications: CatalogPublication[] = response.data.publications.map(
          (publication) => ({
            id: publication.idPublicacion,
            title: publication.titulo,
            description: publication.descripcion,
            price: Number(publication.precioBase),
            currency: 'CLP',
            type: publication.tipoServicio,
            sellerId: publication.idUsuarioVendedor,
            categoryId: publication.categoriaId,
            createdAtRelative: formatRelativeTime(
              publication.fechaCreacion || publication.createdAt,
            ),
          }),
        );

        const meta = response.data.meta;

        return {
          publications,
          total: Number(meta?.totalRecords ?? publications.length),
          totalPages: meta?.totalPages,
          currentPage: meta?.currentPage,
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
   * Crea una nueva publicación.
   */
  createPublication: async (
    data: Omit<CatalogPublication, 'id' | 'createdAtRelative'>,
  ): Promise<CatalogPublication | null> => {
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

    const response = await api.post<PublicationResponse>(
      `${CATALOG_API_URL}/v1/publications`,
      payload,
    );

    const publication = response.data.publication;

    if (!publication) {
      return null;
    }

    return {
      id: publication.idPublicacion,
      title: publication.titulo,
      description: publication.descripcion,
      price: Number(publication.precioBase) || 0,
      currency: 'CLP',
      type: publication.tipoServicio,
      sellerId: publication.idUsuarioVendedor,
      categoryId: publication.categoriaId,
      createdAtRelative: formatRelativeTime(publication.fechaCreacion || publication.createdAt),
    };
  },
};
