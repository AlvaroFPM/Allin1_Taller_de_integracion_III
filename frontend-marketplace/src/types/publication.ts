export type PublicationCategory = 
  | 'SERVICES' 
  | 'PRODUCTS' 
  | 'RENTALS' 
  | 'OTHER';

/**
 * Entidad principal de Publicación retenida en la base de datos de Go.
 */
export interface Publication {
  id: string;
  authorId: string;
  title: string;
  description: string;
  price: number;
  category: PublicationCategory;
  imageUrls: string[];
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para la creación de publicaciones (Campos de texto base).
 */
export interface CreatePublicationTextDTO {
  title: string;
  description: string;
  price: number;
  category: PublicationCategory;
}

/**
 * Respuesta paginada devuelta por el servidor gRPC/REST al listar publicaciones.
 */
export interface GetPublicationsResponseDTO {
  publications: Publication[];
  totalCount: number;
  page: number;
  limit: number;
}