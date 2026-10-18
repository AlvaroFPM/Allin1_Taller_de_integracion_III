import api from '@/lib/axios';
import type {
  ListMyPurchasesRequestDto,
  ListMySalesRequestDto,
  ListOrdersResponseDto,
} from '@/types/dto/orders';

const ORDERS_API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';

export const ordersQueryService = {
  getPurchases: async (
    params: ListMyPurchasesRequestDto = {},
    signal?: AbortSignal,
  ): Promise<ListOrdersResponseDto> => {
    const response = await api.get<ListOrdersResponseDto>(
      `${ORDERS_API_URL}/v1/orders/mis-compras`,
      { params, signal },
    );
    return response.data;
  },

  getSales: async (
    params: ListMySalesRequestDto = {},
    signal?: AbortSignal,
  ): Promise<ListOrdersResponseDto> => {
    const response = await api.get<ListOrdersResponseDto>(
      `${ORDERS_API_URL}/v1/orders/mis-ventas`,
      { params, signal },
    );
    return response.data;
  },
};
