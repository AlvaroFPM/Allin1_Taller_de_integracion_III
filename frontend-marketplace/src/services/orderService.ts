import api from '@/lib/axios';
import type { CreateOrderRequestDto, CreateOrderResponseDto } from '@/types/dto/orders';

// Puerto local declarado en docker-compose.yml.
// La configuración no demuestra disponibilidad del servicio.
const ORDERS_API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';

export const orderService = {
  createOrder: async (data: CreateOrderRequestDto): Promise<CreateOrderResponseDto> => {
    if (
      !Number.isInteger(data.idUsuarioVendedor) ||
      (data.idUsuarioVendedor ?? 0) <= 0 ||
      !Number.isInteger(data.idPublicacion) ||
      (data.idPublicacion ?? 0) <= 0
    ) {
      throw new Error('La publicación y el vendedor deben tener identificadores válidos.');
    }

    if (!data.precio || !/^[0-9]+$/.test(data.precio) || /^0+$/.test(data.precio)) {
      throw new Error('El precio debe ser un entero positivo.');
    }

    const response = await api.post<CreateOrderResponseDto>(`${ORDERS_API_URL}/v1/orders`, data);

    if (!response.data.order?.idOrden) {
      throw new Error('La API no confirmó la creación de la orden.');
    }

    return response.data;
  },
};
