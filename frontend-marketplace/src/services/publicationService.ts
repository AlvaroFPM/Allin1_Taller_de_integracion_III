import api from '@/lib/axios';
import type { PublicationCategory } from '@/types/publication';

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

// URL base para el microservicio de Catálogo. Usa variable de entorno o cae a localhost para desarrollo.
const CATALOG_API_URL = process.env.NEXT_PUBLIC_CATALOG_API_URL || 'http://localhost:8082';

export const publicationService = {
  /**
   * Obtiene la lista de categorías reales desde el backend
   */
  getCategories: async (): Promise<PublicationCategory[]> => {
    try {
      // Usamos axios directamente a la URL de Catálogo
      const response = await api.get(`${CATALOG_API_URL}/v1/categories`);
      
      // Mapeamos el proto Category al interface del frontend
      if (response.data && response.data.categories) {
        return response.data.categories.map((c: any) => ({
          id: c.idCategoria,
          nombre: c.nombre,
          slug: c.slug,
          icono: c.iconoUrl || '📌',
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  /**
   * Obtiene la lista paginada de publicaciones
   */
  getPublications: async (params: ListPublicationsParams = {}): Promise<{ publications: CatalogPublication[], total: number }> => {
    try {
      const response = await api.get(`${CATALOG_API_URL}/v1/publications`, { params });
      
      if (response.data && response.data.publications) {
        const publications = response.data.publications.map((p: any) => ({
          id: p.idPublicacion,
          title: p.titulo,
          description: p.descripcion,
          price: p.precioBase,
          currency: 'CLP',
          type: p.tipoServicio,
          sellerId: p.idUsuarioVendedor,
          categoryId: p.categoriaId,
          createdAtRelative: 'Recientemente', // TODO: Parsear google.protobuf.Timestamp
        }));
        
        return {
          publications,
          total: response.data.totalRecords || publications.length,
        };
      }
      return { publications: [], total: 0 };
    } catch (error) {
      console.error('Error fetching publications:', error);
      return { publications: [], total: 0 };
    }
  },

  /**
   * Crea una nueva publicación
   */
  createPublication: async (data: Omit<CatalogPublication, 'id' | 'createdAtRelative'>): Promise<CatalogPublication | null> => {
    try {
      // Mapear TRABAJO/SERVICIO/ARTICULO a OFERTA/DEMANDA según el proto de Go
      const mapTipoServicio = (tipo: string) => {
        // Asumimos que si ofrecen servicio es OFERTA, de lo contrario DEMANDA
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
        ciudad: "Santiago", // Por defecto
        region: "RM", // Por defecto
      };
      
      const response = await api.post(`${CATALOG_API_URL}/v1/publications`, payload);
      
      if (response.data && response.data.publication) {
        const p = response.data.publication;
        return {
          id: p.idPublicacion,
          title: p.titulo,
          description: p.descripcion,
          price: p.precioBase,
          currency: 'CLP',
          type: p.tipoServicio,
          sellerId: p.idUsuarioVendedor,
          categoryId: p.categoriaId,
          createdAtRelative: 'Recién creado',
        };
      }
      return null;
    } catch (error) {
      console.error('Error creating publication:', error);
      throw error;
    }
  }
};
