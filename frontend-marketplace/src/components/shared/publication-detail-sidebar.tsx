'use client';

import { Button } from '@/components/ui';

export interface PublicationDetailSidebarProps {
  price: number;
  currency?: string;
  priceLabel?: string;
  actionText?: string;
  onAction?: () => void;
}

export function PublicationDetailSidebar({
  price,
  currency = 'CLP',
  priceLabel = 'Precio publicado',
  actionText = 'Acción no disponible',
  onAction,
}: PublicationDetailSidebarProps) {
  const validPrice = Number.isFinite(price) && price >= 0;

  return (
    <div className="space-y-6 rounded-3xl border border-border-base bg-surface-main p-6 text-center shadow-2xs sm:p-8">
      <div className="space-y-1">
        <span className="text-[11px] font-extrabold tracking-wider text-content-muted uppercase">
          {priceLabel}
        </span>

        <div className="text-3xl font-black text-brand sm:text-4xl">
          {validPrice ? (
            <>
              ${price.toLocaleString('es-CL')}{' '}
              <span className="text-lg font-bold text-content-muted">{currency}</span>
            </>
          ) : (
            <span className="text-lg text-content-muted">Precio no disponible</span>
          )}
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onAction}
        disabled={!onAction}
        className="py-4 text-base font-extrabold shadow-sm"
      >
        {onAction ? `${actionText} →` : 'Acción no disponible'}
      </Button>
    </div>
  );
}
