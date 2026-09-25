'use client';

import * as React from 'react';
import type { CatalogPublication } from '@/types/catalog';
import { cn } from '@/lib/utils';

export interface PublicationCardProps {
  publication: CatalogPublication;
  onAction?: (publication: CatalogPublication) => void;
}

export function PublicationCard({ publication, onAction }: PublicationCardProps) {
  const isJob = publication.type === 'TRABAJO';
  const isArticle = publication.type === 'ARTICULO';

  return (
    <article className="bg-surface-main border border-border-base rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between text-left gap-4">
      {/* Cabecera: Badge de tipo y tiempo relativo */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wide uppercase',
            isJob && 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
            isArticle && 'bg-purple-50 text-purple-700 border border-purple-200/60',
            !isJob && !isArticle && 'bg-blue-50 text-blue-700 border border-blue-200/60',
          )}
        >
          {publication.type === 'TRABAJO' && 'TRABAJO SOLICITADO'}
          {publication.type === 'ARTICULO' && 'ARTÍCULO EN VENTA'}
          {publication.type === 'SERVICIO' && 'SERVICIO OFRECIDO'}
        </span>
        <span className="text-xs text-content-muted">{publication.createdAtRelative}</span>
      </div>

      {/* Contenido: Título y descripción */}
      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-content-main leading-snug line-clamp-1">
          {publication.title}
        </h3>
        <p className="text-xs text-content-muted leading-relaxed line-clamp-2">
          {publication.description}
        </p>
      </div>

      {/* Caja de Detalles Técnicos / Logísticos */}
      <div className="bg-surface-base border border-border-base/70 rounded-xl p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between text-content-main gap-2">
          <span className="text-content-muted">{publication.details.label1}</span>
          <span className="font-semibold truncate">{publication.details.value1}</span>
        </div>
        {publication.details.label2 && (
          <div className="flex items-center justify-between text-content-main gap-2 border-t border-border-base/40 pt-1.5">
            <span className="text-content-muted">{publication.details.label2}</span>
            <span className="font-semibold truncate">{publication.details.value2}</span>
          </div>
        )}
      </div>

      {/* Pie de tarjeta: Precio y botón de acción */}
      <div className="flex items-end justify-between gap-3 pt-1 border-t border-border-base/40">
        <div>
          <span className="block text-[10px] font-bold tracking-wider text-content-muted uppercase">
            {publication.priceTypeLabel}
          </span>
          <span className="text-lg sm:text-xl font-black text-emerald-800 tracking-tight">
            ${publication.price.toLocaleString('es-CL')} {publication.currency}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAction?.(publication)}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs hover:shadow-xs active:scale-98',
            publication.actionButtonText === 'Aceptar Trabajo'
              ? 'bg-emerald-800 text-surface-main hover:bg-emerald-700'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100',
          )}
        >
          {publication.actionButtonText}
        </button>
      </div>
    </article>
  );
}
