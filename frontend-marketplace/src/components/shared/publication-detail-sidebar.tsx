'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export interface PublicationDetailSidebarProps {
  price: number;
  currency?: string;
  priceLabel?: string;
  actionText?: string;
  onAction?: () => void;
  hideAction?: boolean;
  notice?: string;
  linkHref?: string;
  linkText?: string;
}

export function PublicationDetailSidebar({
  price,
  currency = 'CLP',
  priceLabel = 'Precio publicado',
  actionText = 'Acción no disponible',
  onAction,
  hideAction = false,
  notice,
  linkHref,
  linkText,
}: PublicationDetailSidebarProps) {
  const validPrice = Number.isFinite(price) && price >= 0;

  return (
    <div className="space-y-5 rounded-3xl border border-border-base bg-surface-main p-6 text-center shadow-2xs sm:p-8">
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

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs font-semibold text-emerald-900">
          {notice}
        </div>
      )}

      {linkHref && linkText && (
        <Link href={linkHref} className="block">
          <Button variant="secondary" size="lg" fullWidth className="py-3.5 text-sm font-bold">
            {linkText}
          </Button>
        </Link>
      )}

      {!hideAction && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onAction}
          disabled={!onAction}
          className="py-4 text-base font-extrabold shadow-sm"
        >
          {onAction ? `${actionText} →` : actionText}
        </Button>
      )}
    </div>
  );
}
