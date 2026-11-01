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
  categoryName?: string;
  categorySlug?: string;
  location?: string;
  createdAtRelative: string;
}

export interface ListPublicationsParams {
  page?: number;
  limit?: number;
  categoriaId?: number;
  categoria_id?: number;
  query?: string;
  tipoServicio?: 'OFERTA' | 'DEMANDA';
  tipo_servicio?: 'OFERTA' | 'DEMANDA';
  userId?: number;
  user_id?: number;
  excludeUserId?: number;
  exclude_user_id?: number;
  minPrice?: number;
  min_price?: number;
  maxPrice?: number;
  max_price?: number;
}

export interface ListPublicationsResult {
  publications: CatalogPublication[];
  total: number;
  totalPages?: number;
  currentPage?: number;
}

// Interfaces internas para mapear las respuestas del backend.
interface RawCategory {
  idCategoria?: number;
  id_categoria?: number;
  nombre?: string;
  slug?: string;
  iconoUrl?: string;
  icono_url?: string;
}

interface RawPublication {
  idPublicacion?: number;
  id_publicacion?: number;
  titulo?: string;
  descripcion?: string;
  precioBase?: string | number;
  precio_base?: string | number;
  tipoServicio?: string;
  tipo_servicio?: string;
  idUsuarioVendedor?: number;
  id_usuario_vendedor?: number;
  categoriaId?: number;
  categoria_id?: number;
  ciudad?: string;
  region?: string;
  categoria?: RawCategory;
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
    const response = await axios.get<PublicationResponse>(
      `${CATALOG_API_URL}/v1/publications/${encodeURIComponent(id)}`,
      { signal },
    );

    const publication = response.data.publication;

    if (!publication) {
      throw new Error('La API no devolvió la publicación.');
    }

    const idPub = Number(publication.idPublicacion ?? publication.id_publicacion ?? id);
    const rawCat = publication.categoria;
    const catName = rawCat?.nombre || 'General';
    const catSlug = rawCat?.slug || 'general';
    const ciudad = publication.ciudad || '';
    const region = publication.region || '';
    const locationStr = ciudad && region ? `${ciudad}, ${region}` : ciudad || region || 'Chile';
    const rawType = String(publication.tipoServicio || publication.tipo_servicio || 'OFERTA');
    const typeStr = rawType === '2' || rawType.toUpperCase() === 'DEMANDA' ? 'DEMANDA' : 'OFERTA';

    return {
      id: idPub,
      title: publication.titulo || '',
      description: publication.descripcion || '',
      price: Number(publication.precioBase ?? publication.precio_base ?? 0),
      currency: 'CLP',
      type: typeStr,
      sellerId: Number(publication.idUsuarioVendedor ?? publication.id_usuario_vendedor ?? 0),
      categoryId: Number(publication.categoriaId ?? publication.categoria_id ?? 0),
      categoryName: catName,
      categorySlug: catSlug,
      location: locationStr,
      createdAtRelative: formatRelativeTime(publication.fechaCreacion || publication.createdAt),
    };
  },

  /**
   * Obtiene la lista de categorías reales desde el backend.
   */
  getCategories: async (): Promise<PublicationCategory[]> => {
    try {
      const response = await axios.get<{ categories?: RawCategory[] }>(
        `${CATALOG_API_URL}/v1/categories`,
      );

      return (response.data.categories ?? []).map((category) => ({
        id: Number(category.idCategoria ?? category.id_categoria ?? 0),
        nombre: category.nombre || '',
        slug: category.slug || '',
        icono: category.iconoUrl || category.icono_url || '📌',
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
   * Se utiliza axios público para evitar que el interceptor inyecte el JWT en la consulta general,
   * permitiendo que el usuario vea todas las publicaciones (incluidas las suyas) en /explorar.
   */
  getPublications: async (params: ListPublicationsParams = {}): Promise<ListPublicationsResult> => {
    try {
      const queryParams: Record<string, string | number> = {};
      if (params.page) queryParams.page = params.page;
      if (params.limit) queryParams.limit = params.limit;
      if (params.categoriaId !== undefined || params.categoria_id !== undefined) {
        const cat = (params.categoriaId ?? params.categoria_id)!;
        queryParams.categoriaId = cat;
        queryParams.categoria_id = cat;
      }
      if (params.tipoServicio || params.tipo_servicio) {
        const tipo = params.tipoServicio || params.tipo_servicio!;
        queryParams.tipoServicio = tipo;
        queryParams.tipo_servicio = tipo;
      }
      if (params.userId !== undefined || params.user_id !== undefined) {
        const uid = (params.userId ?? params.user_id)!;
        queryParams.userId = uid;
        queryParams.user_id = uid;
      }
      if (params.excludeUserId !== undefined || params.exclude_user_id !== undefined) {
        const exUid = (params.excludeUserId ?? params.exclude_user_id)!;
        queryParams.excludeUserId = exUid;
        queryParams.exclude_user_id = exUid;
      }
      if (params.minPrice !== undefined || params.min_price !== undefined) {
        const minP = (params.minPrice ?? params.min_price)!;
        queryParams.minPrice = minP;
        queryParams.min_price = minP;
      }
      if (params.maxPrice !== undefined || params.max_price !== undefined) {
        const maxP = (params.maxPrice ?? params.max_price)!;
        queryParams.maxPrice = maxP;
        queryParams.max_price = maxP;
      }

      const response = await axios.get<ListPublicationsResponse>(
        `${CATALOG_API_URL}/v1/publications`,
        { params: queryParams },
      );

      if (response.data.publications) {
        const publications: CatalogPublication[] = response.data.publications.map((publication) => {
          const idPub = Number(publication.idPublicacion ?? publication.id_publicacion ?? 0);
          const rawCat = publication.categoria;
          const catName = rawCat?.nombre || 'General';
          const catSlug = rawCat?.slug || 'general';
          const ciudad = publication.ciudad || '';
          const region = publication.region || '';
          const locationStr =
            ciudad && region ? `${ciudad}, ${region}` : ciudad || region || 'Chile';
          const rawType = String(publication.tipoServicio || publication.tipo_servicio || 'OFERTA');
          const typeStr =
            rawType === '2' || rawType.toUpperCase() === 'DEMANDA' ? 'DEMANDA' : 'OFERTA';

          return {
            id: idPub,
            title: publication.titulo || '',
            description: publication.descripcion || '',
            price: Number(publication.precioBase ?? publication.precio_base ?? 0),
            currency: 'CLP',
            type: typeStr,
            sellerId: Number(publication.idUsuarioVendedor ?? publication.id_usuario_vendedor ?? 0),
            categoryId: Number(publication.categoriaId ?? publication.categoria_id ?? 0),
            categoryName: catName,
            categorySlug: catSlug,
            location: locationStr,
            createdAtRelative: formatRelativeTime(
              publication.fechaCreacion || publication.createdAt,
            ),
          };
        });

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
      ciudad: data.location || 'Santiago',
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

    const idPub = Number(publication.idPublicacion ?? publication.id_publicacion ?? 0);
    const rawCat = publication.categoria;
    const catName = rawCat?.nombre || data.categoryName || 'General';
    const catSlug = rawCat?.slug || data.categorySlug || 'general';
    const ciudad = publication.ciudad || data.location || '';
    const region = publication.region || '';
    const locationStr = ciudad && region ? `${ciudad}, ${region}` : ciudad || region || 'Chile';
    const rawType = String(
      publication.tipoServicio || publication.tipo_servicio || data.type || 'OFERTA',
    );
    const typeStr = rawType === '2' || rawType.toUpperCase() === 'DEMANDA' ? 'DEMANDA' : 'OFERTA';

    return {
      id: idPub,
      title: publication.titulo || data.title,
      description: publication.descripcion || data.description,
      price: Number(publication.precioBase ?? publication.precio_base ?? data.price),
      currency: 'CLP',
      type: typeStr,
      sellerId: Number(
        publication.idUsuarioVendedor ?? publication.id_usuario_vendedor ?? data.sellerId,
      ),
      categoryId: Number(publication.categoriaId ?? publication.categoria_id ?? data.categoryId),
      categoryName: catName,
      categorySlug: catSlug,
      location: locationStr,
      createdAtRelative: formatRelativeTime(publication.fechaCreacion || publication.createdAt),
    };
  },
};
