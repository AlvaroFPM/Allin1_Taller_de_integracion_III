import axios from 'axios';
import { create } from 'zustand';
import { ordersQueryService } from '@/services/ordersQueryService';
import type {
  ListMyPurchasesRequestDto,
  ListMySalesRequestDto,
  ListOrdersResponseDto,
  OrderDto,
  OrdersPaginationMetaDto,
} from '@/types/dto/orders';

interface OrdersListState {
  orders: OrderDto[];
  meta: OrdersPaginationMetaDto | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

interface OrdersState {
  purchases: OrdersListState;
  sales: OrdersListState;
  purchasesParams: ListMyPurchasesRequestDto;
  salesParams: ListMySalesRequestDto;
  loadPurchases: (params?: ListMyPurchasesRequestDto, signal?: AbortSignal) => Promise<void>;
  loadSales: (params?: ListMySalesRequestDto, signal?: AbortSignal) => Promise<void>;
  reset: () => void;
}

const initialList = (): OrdersListState => ({
  orders: [],
  meta: null,
  status: 'idle',
  error: null,
});

export const useOrdersStore = create<OrdersState>()((set) => {
  const requestIds = { purchases: 0, sales: 0 };

  async function load(
    key: 'purchases' | 'sales',
    query: () => Promise<ListOrdersResponseDto>,
    signal?: AbortSignal,
  ): Promise<void> {
    const requestId = ++requestIds[key];

    set({ [key]: { ...initialList(), status: 'loading' } });

    try {
      const result = await query();

      if (requestId !== requestIds[key]) return;

      if (signal?.aborted) {
        set({ [key]: initialList() });
        return;
      }

      if (
        !result ||
        typeof result !== 'object' ||
        (result.orders !== undefined && !Array.isArray(result.orders))
      ) {
        throw new Error('La API devolvió una lista de órdenes inválida.');
      }

      set({
        [key]: {
          orders: result.orders ?? [],
          meta: result.meta ?? null,
          status: 'success',
          error: null,
        },
      });
    } catch (error: unknown) {
      if (requestId !== requestIds[key]) return;

      if (signal?.aborted || axios.isCancel(error)) {
        set({ [key]: initialList() });
        return;
      }

      set({
        [key]: {
          ...initialList(),
          status: 'error',
          error: 'No pudimos cargar las órdenes. Inténtalo nuevamente.',
        },
      });
    }
  }

  return {
    purchases: initialList(),
    sales: initialList(),
    purchasesParams: {},
    salesParams: {},

    loadPurchases: (params = {}, signal) => {
      const snapshot = { ...params };
      set({ purchasesParams: snapshot });
      return load('purchases', () => ordersQueryService.getPurchases(snapshot, signal), signal);
    },

    loadSales: (params = {}, signal) => {
      const snapshot = { ...params };
      set({ salesParams: snapshot });
      return load('sales', () => ordersQueryService.getSales(snapshot, signal), signal);
    },

    reset: () => {
      requestIds.purchases++;
      requestIds.sales++;
      set({
        purchases: initialList(),
        sales: initialList(),
        purchasesParams: {},
        salesParams: {},
      });
    },
  };
});
