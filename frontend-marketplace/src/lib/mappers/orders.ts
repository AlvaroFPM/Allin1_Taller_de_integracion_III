import type { OrderDto } from '@/types/dto/orders';
import type { DashboardOrder, OrderRole, OrderStatus } from '@/types/orders-dashboard';

export function toDashboardOrder(order: OrderDto, role: OrderRole): DashboardOrder {
  if (!order || !Number.isInteger(order.idOrden) || (order.idOrden ?? 0) <= 0) {
    throw new Error('La API devolvió una orden sin identificador válido.');
  }

  const validStates = [
    'ESTADO_ORDEN_UNSPECIFIED',
    'PENDIENTE',
    'ACEPTADA',
    'COMPLETADA',
    'CANCELADA',
  ];
  const status = order.estado ?? 'ESTADO_ORDEN_UNSPECIFIED';
  if (!validStates.includes(status)) {
    throw new Error('La API devolvió un estado no reconocido.');
  }

  const counterpartId = role === 'COMPRA' ? order.idUsuarioVendedor : order.idUsuarioComprador;

  return {
    id: String(order.idOrden),
    orderNumber: `Orden #${order.idOrden}`,
    role,
    title: order.idPublicacion ? `Publicación #${order.idPublicacion}` : 'Publicación no informada',
    type: null,
    category: '',
    status: status as OrderStatus,
    createdAt: order.createdAt || 'Fecha no informada',
    // int64: conservar el texto sin convertir a Number.
    price: typeof order.precio === 'string' && /^-?\d+$/.test(order.precio) ? order.precio : null,
    escrowSecured: null,
    counterpartName: counterpartId ? `Usuario #${counterpartId}` : 'Usuario no informado',
    counterpartRole: role === 'COMPRA' ? 'Vendedor' : 'Comprador',
    counterpartInitials: '?',
  };
}
