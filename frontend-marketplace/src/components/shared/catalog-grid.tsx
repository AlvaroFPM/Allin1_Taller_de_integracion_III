'use client';

import * as React from 'react';
import type { CatalogPublication } from '@/types/catalog';
import { PublicationCard } from './publication-card';
import { cn } from '@/lib/utils';

export interface CatalogGridProps {
  publications: CatalogPublication[];
  totalCount: number;
  sortBy: 'recent' | 'price_asc' | 'price_desc';
  onSortChange: (sort: 'recent' | 'price_asc' | 'price_desc') => void;
  onAction: (pub: CatalogPublication) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function CatalogGrid({
  publications,
  totalCount,
  sortBy,
  onSortChange,
  onAction,
  currentPage = 1,
  onPageChange,
}: CatalogGridProps) {
  return (
    <div className="space-y-5 flex-1 min-w-0 text-left">
      {/* Barra superior de la grilla: Contador de resultados y selector de orden */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-black text-content-main tracking-tight">
          Explorando {totalCount} publicaciones
        </h2>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as 'recent' | 'price_asc' | 'price_desc')}
          className="h-9 px-3 text-xs bg-surface-main border border-border-base rounded-xl text-content-main focus:outline-hidden focus:border-brand cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <option value="recent">Más recientes primero</option>
          <option value="price_asc">Menor precio</option>
          <option value="price_desc">Mayor precio</option>
        </select>
      </div>

      {/* Grilla de Publicaciones */}
      {publications.length === 0 ? (
        <div className="bg-surface-main border border-border-base rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center mx-auto text-xl">
            🔍
          </div>
          <h3 className="text-sm font-bold text-content-main">No hay publicaciones disponibles</h3>
          <p className="text-xs text-content-muted max-w-sm mx-auto">
            Prueba ajustando los filtros de categoría, precio o término de búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {publications.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} onAction={onAction} />
          ))}
        </div>
      )}

      {/* Paginador Inferior */}
      {publications.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 pt-6">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange?.(page)}
              className={cn(
                'w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center',
                currentPage === page
                  ? 'bg-emerald-800 text-surface-main shadow-2xs'
                  : 'bg-surface-main border border-border-base text-content-main hover:bg-surface-base',
              )}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange?.(currentPage + 1)}
            className="h-9 px-3 rounded-xl text-xs font-bold bg-surface-main border border-border-base text-content-main hover:bg-surface-base transition-all cursor-pointer flex items-center justify-center"
            aria-label="Página siguiente"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
