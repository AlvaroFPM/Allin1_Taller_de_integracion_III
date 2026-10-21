export interface SellerReview {
  id: string;
  sellerId?: string;
  authorName: string;
  authorInitials: string;
  authorAvatarUrl?: string;
  rating: number;
  comment: string;
  createdAt: string;
  serviceTitle: string;
  verifiedPurchase?: boolean;
}

export interface SellerReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution?: {
    stars: number;
    count: number;
    percentage: number;
  }[];
}

export const MOCK_SELLER_REVIEWS: SellerReview[] = [
  {
    id: 'rev-1',
    sellerId: 'user-1',
    authorName: 'Camila Rivas',
    authorInitials: 'CR',
    rating: 5,
    comment:
      'Excelente disposición y puntualidad. El flete llegó a tiempo y todo venía perfectamente embalado. 100% recomendado.',
    createdAt: 'Hace 2 días',
    serviceTitle: 'Flete: Traslado de Sillón y 4 Cajas',
    verifiedPurchase: true,
  },
  {
    id: 'rev-2',
    sellerId: 'user-1',
    authorName: 'Matías Valenzuela',
    authorInitials: 'MV',
    rating: 5,
    comment:
      'Solucionó la filtración de la cocina en menos de una hora. Muy profesional, prolijo y transparente con el presupuesto.',
    createdAt: 'Hace 1 semana',
    serviceTitle: 'Reparación de Cañería Filtrada en Cocina',
    verifiedPurchase: true,
  },
  {
    id: 'rev-3',
    sellerId: 'user-1',
    authorName: 'Fernanda Salgado',
    authorInitials: 'FS',
    rating: 4,
    comment:
      'Buen servicio en general. Cumplió con lo pactado, aunque llegó con unos 15 minutos de retraso por congestión vehicular.',
    createdAt: 'Hace 3 semanas',
    serviceTitle: 'Mantención de Calefont y Grifería',
    verifiedPurchase: true,
  },
  {
    id: 'rev-4',
    sellerId: 'user-2',
    authorName: 'Jorge Contreras',
    authorInitials: 'JC',
    rating: 5,
    comment:
      'Mariana hizo un trabajo impecable con la pintura y los detalles eléctricos. Muy ordenada y confiable.',
    createdAt: 'Hace 4 días',
    serviceTitle: 'Pintura y Reparaciones Eléctricas Menores',
    verifiedPurchase: true,
  },
  {
    id: 'rev-5',
    sellerId: 'user-3',
    authorName: 'Lucía Benítez',
    authorInitials: 'LB',
    rating: 4,
    comment:
      'Compré el set de herramientas. Venía sellado, nuevo de fábrica y la entrega en Santiago Centro fue el mismo día.',
    createdAt: 'Hace 1 semana',
    serviceTitle: 'Set de Herramientas Multiuso 48 Piezas',
    verifiedPurchase: true,
  },
];
