import api from '@/lib/axios';
import type { OrderDto, PatchOrderStatusResponseDto } from '@/types/dto/orders';

export type OrderActionState = 'ACEPTADA' | 'COMPLETADA';

const ORDERS_API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';

export const ordersMutationService = {
  patchStatus: async (
    idOrden: number,
    nuevoEstado: OrderActionState,
    signal?: AbortSignal,
  ): Promise<OrderDto> => {
    if (!Number.isSafeInteger(idOrden) || idOrden <= 0) {
      throw new Error('Identificador de orden invalido.');
    }

    // Validacion en ejecucion: tampoco admite cancelacion desde JavaScript.
    if (nuevoEstado !== 'ACEPTADA' && nuevoEstado !== 'COMPLETADA') {
      throw new Error('Accion de orden no permitida.');
    }

    const response = await api.patch<PatchOrderStatusResponseDto>(
      `${ORDERS_API_URL}/v1/orders/${idOrden}`,
      { nuevoEstado },
      { signal },
    );

    const order = response.data?.order;

    if (
      !order ||
      typeof order !== 'object' ||
      Array.isArray(order) ||
      order.idOrden !== idOrden ||
      order.estado !== nuevoEstado
    ) {
      throw new Error(
        'Respuesta PATCH invalida. No se pudo confirmar el cambio; consulta la orden antes de reintentar.',
      );
    }

    return order;
  },
};
