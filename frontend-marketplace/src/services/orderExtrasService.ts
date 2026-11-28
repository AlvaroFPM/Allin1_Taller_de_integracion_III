import axios from 'axios';
import api from '@/lib/axios';

const ORDERS_API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';

export interface OrderReviewDto {
  idReview: number;
  idOrden: number;
  idPublicacion: number;
  idUsuarioAutor: number;
  idUsuarioEvaluado: number;
  rating: number;
  comentario: string;
  createdAt: string;
}

export interface OrderExtraDto {
  idOrden: number;
  notas: string;
  fechaAcordada: string;
  vendedorConfirmoEntrega: boolean;
  fechaEntregaVendedor?: string;
  review?: OrderReviewDto;
}

export interface UserReviewsResponseDto {
  userId: number;
  averageScore: number;
  totalReviews: number;
  reviews: OrderReviewDto[];
}

export interface PendingSummaryDto {
  pendingSalesCount: number;
  deliveredAwaitingBuyerCount: number;
}

export const orderExtrasService = {
  getExtras: async (
    ids: number[],
    signal?: AbortSignal,
  ): Promise<Record<string, OrderExtraDto>> => {
    const cleanIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
    if (cleanIds.length === 0) return {};
    const { data } = await api.get<{ extras?: Record<string, OrderExtraDto> }>(
      `${ORDERS_API_URL}/v1/orders/extras`,
      { params: { ids: cleanIds.join(',') }, signal },
    );
    return data?.extras ?? {};
  },

  saveExtras: async (
    orderId: number,
    payload: { notas?: string; fechaAcordada?: string },
  ): Promise<OrderExtraDto> => {
    const { data } = await api.put<{ extra: OrderExtraDto }>(
      `${ORDERS_API_URL}/v1/orders/${orderId}/extras`,
      {
        notas: payload.notas?.trim() ?? '',
        fechaAcordada: payload.fechaAcordada?.trim() ?? '',
      },
    );
    return data.extra;
  },

  markDelivered: async (orderId: number): Promise<OrderExtraDto> => {
    const { data } = await api.post<{ extra: OrderExtraDto }>(
      `${ORDERS_API_URL}/v1/orders/${orderId}/deliver`,
      {},
    );
    return data.extra;
  },

  createReview: async (
    orderId: number,
    payload: { rating: number; comentario?: string },
  ): Promise<OrderReviewDto> => {
    const { data } = await api.post<{ review: OrderReviewDto }>(
      `${ORDERS_API_URL}/v1/orders/${orderId}/review`,
      {
        rating: payload.rating,
        comentario: payload.comentario?.trim() ?? '',
      },
    );
    return data.review;
  },

  getUserReviews: async (userId: number, signal?: AbortSignal): Promise<UserReviewsResponseDto> => {
    const { data } = await axios.get<UserReviewsResponseDto>(
      `${ORDERS_API_URL}/v1/reviews/user/${userId}`,
      { signal, timeout: 4000 },
    );
    return {
      userId: data?.userId ?? userId,
      averageScore: typeof data?.averageScore === 'number' ? data.averageScore : 0,
      totalReviews: typeof data?.totalReviews === 'number' ? data.totalReviews : 0,
      reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    };
  },

  getPendingSummary: async (signal?: AbortSignal): Promise<PendingSummaryDto> => {
    const { data } = await api.get<PendingSummaryDto>(
      `${ORDERS_API_URL}/v1/orders/pending-summary`,
      { signal, timeout: 4000 },
    );
    return {
      pendingSalesCount: Number(data?.pendingSalesCount ?? 0),
      deliveredAwaitingBuyerCount: Number(data?.deliveredAwaitingBuyerCount ?? 0),
    };
  },
};
