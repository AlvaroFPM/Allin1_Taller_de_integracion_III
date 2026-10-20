'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardOrder, OrderStatus, OrderItemType } from '@/types/orders-dashboard';

export interface OrderCardProps {
  order: DashboardOrder;
  onConfirmReceipt?: (order: DashboardOrder) => void;
  onMarkCompleted?: (order: DashboardOrder) => void;
  onContact?: (order: DashboardOrder) => void;
  onRate?: (order: DashboardOrder) => void;
  onViewDetail?: (order: DashboardOrder) => void;
}

const STATUS_BADGE_CONFIG: Record<
  OrderStatus,
  { label: string; variant: 'brand' | 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  PAGO_CUSTODIADO: {
    label: 'Pago en Custodia Escrow',
    variant: 'brand',
  },
  EN_PROCESO: {
    label: 'En Proceso',
    variant: 'warning',
  },
  COMPLETADA: {
    label: 'Completada',
    variant: 'success',
  },
  CANCELADA: {
    label: 'Cancelada',
    variant: 'danger',
  },
};

const TYPE_BADGE_VARIANT: Record<OrderItemType, 'brand' | 'warning' | 'neutral'> = {
  SERVICIO: 'brand',
  ARTICULO: 'warning',
  FLETE: 'neutral',
  TRABAJO: 'brand',
};

export function OrderCard({
  order,
  onConfirmReceipt,
  onMarkCompleted,
  onContact,
  onRate,
  onViewDetail,
}: OrderCardProps) {
  const statusConfig = STATUS_BADGE_CONFIG[order.status];
  const typeVariant = TYPE_BADGE_VARIANT[order.type];
  const currency = order.currency ?? 'CLP';

  return (
    <div className="bg-surface-main rounded-2xl border border-border-base p-5 sm:p-6 shadow-xs hover:border-brand/40 transition-all space-y-4">
      {/* Cabecera de la Tarjeta */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-base/70 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-content-main tracking-tight font-mono">
            {order.orderNumber}
          </span>
          <span className="text-content-muted">•</span>
          <span className="text-content-muted">{order.createdAt}</span>
          <Badge variant={typeVariant} size="sm">
            {order.type}
          </Badge>
          {order.category && (
            <span className="text-content-muted hidden sm:inline">({order.category})</span>
          )}
        </div>

        <Badge variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Badge>
      </div>

      {/* Contenido Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <h3 className="text-base font-bold text-content-main leading-snug truncate">
            {order.title}
          </h3>

          {/* Ubicación / Trayecto */}
          {order.location && (
            <p className="text-xs text-content-muted flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-brand shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{order.location}</span>
            </p>
          )}

          {/* Notas de la orden */}
          {order.notes && (
            <p className="text-xs text-content-muted italic bg-surface-base/60 p-2 rounded-lg border border-border-base/60 mt-1">
              &ldquo;{order.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Monto de la Orden */}
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted block">
            {order.role === 'COMPRA' ? 'Total Pagado' : 'Ganancia Neta'}
          </span>
          <p className="text-xl font-black text-brand tracking-tight">
            ${order.price.toLocaleString('es-CL')}{' '}
            <span className="text-xs font-semibold text-content-muted">{currency}</span>
          </p>
          {order.escrowSecured && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Escrow Protegido
            </span>
          )}
        </div>
      </div>

      {/* Contraparte y Botones de Acción */}
      <div className="pt-3 border-t border-border-base/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Identidad de la contraparte */}
        <div className="flex items-center gap-2.5">
          {order.counterpartAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={order.counterpartAvatarUrl}
              alt={order.counterpartName}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[10px] select-none">
              {order.counterpartInitials}
            </div>
          )}
          <div>
            <span className="text-content-muted text-[11px] font-medium mr-1">
              {order.counterpartRole}:
            </span>
            <span className="font-bold text-content-main">{order.counterpartName}</span>
            {order.counterpartVerified && (
              <span className="ml-1 text-emerald-600 font-bold" title="Identidad Verificada">
                ✓
              </span>
            )}
          </div>
        </div>

        {/* Acciones según el rol y estado */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onViewDetail?.(order)}
            className="text-xs"
          >
            Ver Detalle
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onContact?.(order)}
            className="text-xs"
          >
            Contactar
          </Button>

          {/* Acciones de Comprador */}
          {order.role === 'COMPRA' &&
            (order.status === 'PAGO_CUSTODIADO' || order.status === 'EN_PROCESO') && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onConfirmReceipt?.(order)}
                className="text-xs font-bold"
              >
                Confirmar Recepción / Liberar Pago
              </Button>
            )}

          {order.role === 'COMPRA' && order.status === 'COMPLETADA' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRate?.(order)}
              className="text-xs font-semibold"
            >
              ★ Calificar
            </Button>
          )}

          {/* Acciones de Vendedor */}
          {order.role === 'VENTA' &&
            (order.status === 'EN_PROCESO' || order.status === 'PAGO_CUSTODIADO') && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onMarkCompleted?.(order)}
                className="text-xs font-bold"
              >
                Marcar como Terminado
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}
