'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardOrder, OrderStatus } from '@/types/orders-dashboard';

export interface OrderCardProps {
  order: DashboardOrder;
  onAccept?: (order: DashboardOrder) => void;
  onDeliver?: (order: DashboardOrder) => void;
  onComplete?: (order: DashboardOrder) => void;
  onCancel?: (order: DashboardOrder) => void;
  actionPending?: boolean;
  actionError?: string | null;
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
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  ACEPTADA: { label: 'Aceptada', variant: 'brand' },
  ESTADO_ORDEN_UNSPECIFIED: { label: 'Estado no informado', variant: 'neutral' },
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

const PROGRESS_STEPS = ['Solicitada', 'Aceptada', 'Entregada', 'Completada'] as const;

function getProgressStepIndex(order: DashboardOrder): number {
  if (order.status === 'COMPLETADA') return 3;
  if (order.status === 'ACEPTADA') return order.sellerDelivered ? 2 : 1;
  return 0;
}

export function OrderCard({
  order,
  onAccept,
  onDeliver,
  onComplete,
  onCancel,
  actionPending = false,
  actionError,
  onContact,
  onRate,
  onViewDetail,
}: OrderCardProps) {
  const statusConfig =
    order.status === 'ACEPTADA' && order.sellerDelivered
      ? { label: 'Entregada · Por confirmar', variant: 'brand' as const }
      : STATUS_BADGE_CONFIG[order.status];

  const currency = order.currency;
  const priceLabel =
    typeof order.price === 'string' && /^-?\d+$/.test(order.price)
      ? BigInt(order.price).toLocaleString('es-CL')
      : typeof order.price === 'number' && Number.isFinite(order.price)
        ? order.price.toLocaleString('es-CL')
        : 'Monto no informado';

  const stepIndex = getProgressStepIndex(order);
  const showProgress =
    order.status === 'PENDIENTE' || order.status === 'ACEPTADA' || order.status === 'COMPLETADA';

  const counterpartContent = (
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
        <span className="font-bold text-content-main group-hover:text-brand group-hover:underline">
          {order.counterpartName}
        </span>
        {order.counterpartVerified && (
          <span className="ml-1 text-emerald-600 font-bold" title="Identidad Verificada">
            ✓
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-surface-main rounded-2xl border border-border-base p-5 sm:p-6 shadow-xs hover:border-brand/40 transition-all space-y-4">
      {/* Cabecera de la Tarjeta */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-base/70 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-content-main tracking-tight font-mono">
            {order.orderNumber}
          </span>
        </div>

        <Badge variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Badge>
      </div>

      {/* Mini indicador de progreso */}
      {showProgress && (
        <div className="flex items-center gap-1.5 text-[11px]">
          {PROGRESS_STEPS.map((label, idx) => {
            const done = idx <= stepIndex;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`w-2 h-2 rounded-full ${done ? 'bg-brand' : 'bg-border-base'}`}
                  />
                  <span
                    className={
                      done ? 'font-bold text-content-main' : 'font-medium text-content-muted'
                    }
                  >
                    {label}
                  </span>
                </div>
                {idx < PROGRESS_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full ${
                      idx < stepIndex ? 'bg-brand' : 'bg-border-base/80'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Contenido Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <h3 className="text-base font-bold text-content-main leading-snug truncate">
            {order.title}
          </h3>

          {/* Fecha / horario acordado */}
          {order.scheduledDate && (
            <p className="text-xs text-content-main/90 flex items-center gap-1.5">
              <span aria-hidden="true">📅</span>
              <span className="font-medium">Coordinación: {order.scheduledDate}</span>
            </p>
          )}

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
            <p className="text-xs text-content-muted italic bg-surface-base/60 p-2.5 rounded-lg border border-border-base/60 mt-1">
              &ldquo;{order.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Monto de la Orden */}
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted block">
            Monto de la orden
          </span>
          <p className="text-xl font-black text-brand tracking-tight">
            {priceLabel}{' '}
            <span className="text-xs font-semibold text-content-muted">
              {currency ?? (order.price !== null ? 'CLP' : '')}
            </span>
          </p>
        </div>
      </div>

      {/* Contraparte y Botones de Acción */}
      <div className="pt-3 border-t border-border-base/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Identidad de la contraparte con enlace al perfil público */}
        {order.counterpartId && order.counterpartId > 0 ? (
          <Link href={`/perfil/${order.counterpartId}`} className="group inline-flex items-center">
            {counterpartContent}
          </Link>
        ) : (
          counterpartContent
        )}

        {/* Acciones según el rol y estado (doble confirmación + chat + reseña) */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!onViewDetail}
            onClick={() => onViewDetail?.(order)}
            className="text-xs"
          >
            Ver Detalle
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!onContact}
            onClick={() => onContact?.(order)}
            className="text-xs"
          >
            Contactar
          </Button>

          {order.role === 'VENTA' && order.status === 'PENDIENTE' && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={actionPending || !onAccept}
              onClick={() => onAccept?.(order)}
              className="text-xs font-bold"
            >
              {actionPending ? 'Procesando...' : 'Aceptar'}
            </Button>
          )}

          {/* Doble confirmación: Vendedor marca entregado */}
          {order.role === 'VENTA' && order.status === 'ACEPTADA' && !order.sellerDelivered && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={actionPending || !onDeliver}
              onClick={() => onDeliver?.(order)}
              className="text-xs font-bold"
            >
              {actionPending ? 'Procesando...' : 'Marcar entregado'}
            </Button>
          )}

          {order.role === 'VENTA' && order.status === 'ACEPTADA' && order.sellerDelivered && (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              Esperando confirmación del comprador
            </span>
          )}

          {/* Doble confirmación: Comprador confirma recibido conforme */}
          {order.role === 'COMPRA' && order.status === 'ACEPTADA' && !order.sellerDelivered && (
            <span className="text-[11px] font-medium text-content-muted bg-surface-base border border-border-base px-2.5 py-1 rounded-lg">
              Esperando entrega del vendedor
            </span>
          )}

          {order.role === 'COMPRA' && order.status === 'ACEPTADA' && order.sellerDelivered && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={actionPending || !onComplete}
              onClick={() => onComplete?.(order)}
              className="text-xs font-bold"
            >
              {actionPending ? 'Procesando...' : 'Confirmar recibido'}
            </Button>
          )}

          {onCancel && (order.status === 'PENDIENTE' || order.status === 'ACEPTADA') && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={actionPending}
              onClick={() => onCancel?.(order)}
              className="text-xs font-bold"
            >
              {actionPending ? 'Procesando...' : 'Cancelar'}
            </Button>
          )}

          {order.role === 'COMPRA' &&
            order.status === 'COMPLETADA' &&
            (order.review ? (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                ★ {order.review.rating}/5 Calificada
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!onRate}
                onClick={() => onRate?.(order)}
                className="text-xs font-semibold"
              >
                ★ Calificar
              </Button>
            ))}

          {actionPending && <span role="status">Actualizando orden...</span>}
          {actionError && <p role="alert">{actionError}</p>}
        </div>
      </div>
    </div>
  );
}
