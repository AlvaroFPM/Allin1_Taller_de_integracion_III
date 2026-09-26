'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CatalogPublicationType } from '@/types/catalog';
import { COMUNAS_DISPONIBLES } from '@/types/publication';

export interface CatalogSearchHeaderProps {
  search: string;
  onSearchChange: (val: string) => void;
  comuna: string;
  onComunaChange: (val: string) => void;
  onSearchSubmit: () => void;
  activeTab: 'all' | CatalogPublicationType;
  onTabChange: (tab: 'all' | CatalogPublicationType) => void;
  counts: { all: number; trabajo: number; servicio: number; articulo: number };
  onToggleMobileFilters?: () => void;
}

export function CatalogSearchHeader({
  search,
  onSearchChange,
  comuna,
  onComunaChange,
  onSearchSubmit,
  activeTab,
  onTabChange,
  counts,
  onToggleMobileFilters,
}: CatalogSearchHeaderProps) {
  const tabs = [
    { id: 'all', label: 'Todas las Publicaciones', count: counts.all },
    { id: 'TRABAJO', label: 'Trabajos Solicitados', count: counts.trabajo },
    { id: 'SERVICIO', label: 'Servicios Profesionales', count: counts.servicio },
    { id: 'ARTICULO', label: 'Artículos en Venta', count: counts.articulo },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Fila Superior: Buscador de texto, selector de comunas y botón Buscar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            placeholder="Buscar por título, oficio, producto o ubicación..."
            className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-surface-main border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-content-muted"
          />
        </div>

        <select
          value={comuna}
          onChange={(e) => onComunaChange(e.target.value)}
          className="h-11 px-3 text-xs sm:text-sm bg-surface-main border border-border-base rounded-xl text-content-main focus:outline-hidden focus:border-brand cursor-pointer shrink-0"
        >
          <option value="">Todas las Comunas</option>
          {COMUNAS_DISPONIBLES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onSearchSubmit}
          className="h-11 px-6 rounded-xl bg-brand text-surface-main font-bold text-xs sm:text-sm hover:bg-brand/90 transition-all shadow-xs cursor-pointer shrink-0"
        >
          Buscar
        </button>

        {onToggleMobileFilters && (
          <button
            type="button"
            onClick={onToggleMobileFilters}
            className="h-11 px-4 rounded-xl border border-border-base bg-surface-main text-content-main text-xs font-bold md:hidden flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Filtros</span>
          </button>
        )}
      </div>

      {/* Fila Inferior: Pestañas de tipo (Pills) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-left">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id as 'all' | CatalogPublicationType)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border',
                isActive
                  ? 'bg-emerald-800 text-surface-main border-emerald-800 shadow-2xs'
                  : 'bg-surface-main text-content-muted hover:text-content-main border-border-base hover:bg-surface-base',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-extrabold',
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-base text-content-muted',
                )}
              >
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
