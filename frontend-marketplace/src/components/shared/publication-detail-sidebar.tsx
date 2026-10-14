'use client';

import * as React from 'react';
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
  priceLabel = 'PRESUPUESTO DEL CLIENTE',
  actionText = 'Aceptar Trabajo',
  onAction,
}: PublicationDetailSidebarProps) {
  return (
    <div className="bg-surface-main border border-border-base rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6 text-center">
      <div className="space-y-1">
        <span className="text-[11px] font-extrabold tracking-wider text-content-muted uppercase">
          {priceLabel}
        </span>
        <div className="text-3xl sm:text-4xl font-black text-brand tracking-tight">
          ${price.toLocaleString('es-CL')}{' '}
          <span className="text-lg font-bold text-content-muted">{currency}</span>
        </div>
      </div>

      {/* Botón Principal de Acción */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onAction}
        className="py-4 text-base font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        {actionText} →
      </Button>
    </div>
  );
}
