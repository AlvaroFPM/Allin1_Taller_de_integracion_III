'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { PurchaseConfirmationModalProps, PurchaseItemType } from '@/types/order';

const TYPE_CONFIG: Record<
  PurchaseItemType,
  {
    badgeVariant: 'brand' | 'warning' | 'neutral';
    label: string;
    modalTitle: string;
    actionLabel: string;
    priceLabel: string;
  }
> = {
  PUBLICACION: {
    badgeVariant: 'neutral',
    label: 'Publicación',
    modalTitle: 'Confirmar contratación',
    actionLabel: 'Confirmar contratación',
    priceLabel: 'Precio publicado',
  },
  ARTICULO: {
    badgeVariant: 'warning',
    label: 'Artículo',
    modalTitle: 'Confirmar Compra de Artículo',
    actionLabel: 'Confirmar Compra',
    priceLabel: 'Precio del artículo',
  },
  SERVICIO: {
    badgeVariant: 'brand',
    label: 'Servicio',
    modalTitle: 'Confirmar Contratación de Servicio',
    actionLabel: 'Confirmar Contratación',
    priceLabel: 'Presupuesto acordado',
  },
  FLETE: {
    badgeVariant: 'neutral',
    label: 'Flete & Traslado',
    modalTitle: 'Confirmar Contratación de Flete',
    actionLabel: 'Confirmar Flete',
    priceLabel: 'Tarifa de flete',
  },
  TRABAJO: {
    badgeVariant: 'brand',
    label: 'Trabajo Requerido',
    modalTitle: 'Confirmar Asignación de Trabajo',
    actionLabel: 'Confirmar Trabajo',
    priceLabel: 'Monto a comprometer',
  },
};

export function PurchaseConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  isLoading = false,
  errorMessage,
}: PurchaseConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Cierre accesible con tecla Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isLoading, isSubmitting]);

  if (!isOpen) return null;

  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.SERVICIO;
  const totalPrice = item.price;
  const currency = item.currency ?? 'CLP';

  const sellerInitials =
    item.seller.avatarInitials ||
    item.seller.name
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const handleConfirmClick = async () => {
    if (isLoading || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        if (!isLoading && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      <div
        className="w-full max-w-lg bg-surface-main rounded-3xl border border-border-base shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-base">
          <div>
            <h3 id="confirmation-modal-title" className="text-xl font-bold text-content-main">
              {config.modalTitle}
            </h3>
            <p className="text-xs text-content-muted mt-1 leading-relaxed">
              Revisa los detalles antes de confirmar la contratación.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isSubmitting}
            className="p-1.5 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Resumen del Ítem */}
        <div className="bg-surface-base/60 rounded-2xl border border-border-base/80 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={config.badgeVariant} size="sm">
              {config.label}
            </Badge>
            {item.category && (
              <span className="text-[11px] font-medium text-content-muted">{item.category}</span>
            )}
          </div>

          <h4 className="text-base font-bold text-content-main leading-snug">{item.title}</h4>

          {/* Vendedor / Proveedor */}
          <div className="pt-2 border-t border-border-base/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              {item.seller.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.seller.avatarUrl}
                  alt={item.seller.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs select-none">
                  {sellerInitials}
                </div>
              )}
              <div>
                <p className="font-semibold text-content-main">{item.seller.name}</p>
                {item.seller.isVerified && (
                  <span className="text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Identidad Verificada
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desglose de Precios */}
        <div className="bg-surface-base/40 rounded-2xl border border-border-base/70 p-4 space-y-2.5 text-xs">
          <div className="flex justify-between text-content-muted">
            <span>{config.priceLabel}:</span>
            <span className="font-semibold text-content-main">
              ${item.price.toLocaleString('es-CL')} {currency}
            </span>
          </div>

          <div className="pt-2 border-t border-border-base flex justify-between items-baseline">
            <span className="text-sm font-bold text-content-main">Total de la orden:</span>
            <span className="text-xl font-black text-brand">
              ${totalPrice.toLocaleString('es-CL')}{' '}
              <span className="text-xs font-semibold text-content-muted">{currency}</span>
            </span>
          </div>
        </div>

        {/* Instrucciones o Notas Opcionales */}
        <Textarea
          id="purchase-notes"
          label="Notas no disponibles: el contrato de órdenes no admite este campo."
          rows={3}
          value=""
          placeholder="No disponible"
          disabled
        />

        {errorMessage && (
          <p role="alert" className="text-sm text-content-main">
            {errorMessage}
          </p>
        )}

        {/* Botones de Acción (Footer) */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading || isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirmClick}
            isLoading={isLoading || isSubmitting}
          >
            {config.actionLabel} →
          </Button>
        </div>
      </div>
    </div>
  );
}
