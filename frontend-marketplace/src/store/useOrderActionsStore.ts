import { create } from 'zustand';
import { ordersMutationService, type OrderActionState } from '@/services/ordersMutationService';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrdersStore } from '@/store/useOrdersStore';

interface OrderAction {
  pending: boolean;
  error: string | null;
}

interface OrderActionsState {
  actions: Record<number, OrderAction>;
  changeStatus: (idOrden: number, next: OrderActionState) => Promise<void>;
}

export const useOrderActionsStore = create<OrderActionsState>()((set, get) => ({
  actions: {},

  changeStatus: async (idOrden, next) => {
    if (get().actions[idOrden]?.pending) return;

    const fail = (error: string) => {
      set((state) => ({
        actions: { ...state.actions, [idOrden]: { pending: false, error } },
      }));
    };

    const auth = useAuthStore.getState();
    const userId = auth.user?.id;

    if (!auth.isAuthenticated || !auth.token || !userId) {
      fail('Inicia sesion para cambiar el estado.');
      return;
    }

    const lists = useOrdersStore.getState();
    const candidates = [...lists.purchases.orders, ...lists.sales.orders].filter(
      (order) => order.idOrden === idOrden,
    );
    const order = candidates[0];

    if (!Number.isSafeInteger(idOrden) || idOrden <= 0 || !order) {
      fail('La orden no esta disponible. Actualiza la lista.');
      return;
    }

    if (
      candidates.some(
        (candidate) =>
          candidate.estado !== order.estado ||
          candidate.idUsuarioComprador !== order.idUsuarioComprador ||
          candidate.idUsuarioVendedor !== order.idUsuarioVendedor,
      )
    ) {
      fail('Los datos de la orden no coinciden. Actualiza ambas listas.');
      return;
    }

    const isBuyer = order.idUsuarioComprador === userId;
    const isSeller = order.idUsuarioVendedor === userId;
    const allowed =
      (next === 'ACEPTADA' && order.estado === 'PENDIENTE' && isSeller) ||
      (next === 'COMPLETADA' && order.estado === 'ACEPTADA' && (isBuyer || isSeller));

    if (!allowed) {
      fail('No tienes permiso para esa transicion de estado.');
      return;
    }

    // Se establece antes del primer await para impedir el doble envio.
    set((state) => ({
      actions: {
        ...state.actions,
        [idOrden]: { pending: true, error: null },
      },
    }));

    const controller = new AbortController();
    let sessionChanged = false;
    const unsubscribe = useAuthStore.subscribe((current) => {
      if (sessionChanged) return;
      if (
        current.user?.id !== userId ||
        current.token !== auth.token ||
        current.isAuthenticated !== auth.isAuthenticated
      ) {
        sessionChanged = true;
        controller.abort();
        set({ actions: {} });
      }
    });

    try {
      await ordersMutationService.patchStatus(idOrden, next, controller.signal);
      if (sessionChanged) return;

      // Nuevas consultas invalidan las respuestas GET anteriores.
      // Mantiene la pagina independiente de cada lista.
      const current = useOrdersStore.getState();
      const refreshes: Promise<void>[] = [];

      if (current.purchases.status !== 'idle') {
        refreshes.push(
          current.loadPurchases(
            current.purchasesParams ?? { page: current.purchases.meta?.currentPage ?? 1 },
            controller.signal,
          ),
        );
      }
      if (current.sales.status !== 'idle') {
        refreshes.push(
          current.loadSales(
            current.salesParams ?? { page: current.sales.meta?.currentPage ?? 1 },
            controller.signal,
          ),
        );
      }

      await Promise.all(refreshes);
      if (sessionChanged) return;

      const refreshed = useOrdersStore.getState();
      const refreshFailed =
        refreshed.purchases.status === 'error' || refreshed.sales.status === 'error';

      set((state) => ({
        actions: {
          ...state.actions,
          [idOrden]: {
            pending: false,
            error: refreshFailed
              ? 'El cambio fue confirmado, pero no se pudieron actualizar todas las listas. Recarga las ordenes.'
              : null,
          },
        },
      }));
    } catch {
      if (sessionChanged) return;
      fail('No se pudo confirmar el cambio. Consulta nuevamente la orden antes de reintentar.');
    } finally {
      unsubscribe();
    }
  },
}));

// Limpiar tambien acciones finalizadas, sin depender de un PATCH pendiente.
// Suscripcion unica durante la vida de este modulo/store.
useAuthStore.subscribe((current, previous) => {
  if (
    current.user?.id !== previous.user?.id ||
    current.token !== previous.token ||
    current.isAuthenticated !== previous.isAuthenticated
  ) {
    useOrderActionsStore.setState({ actions: {} });
  }
});
