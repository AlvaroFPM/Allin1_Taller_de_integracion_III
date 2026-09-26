'use client';

import * as React from 'react';
import type { CatalogFilterState } from '@/types/catalog';

export interface CatalogSidebarFiltersProps {
  filters: CatalogFilterState;
  onChange: (fields: Partial<CatalogFilterState>) => void;
  onApply: () => void;
  onReset: () => void;
  categoryCounts: Record<string, number>;
}

const CATEGORIES = [
  { slug: 'mantenimiento', label: 'Mantenimiento Hogar' },
  { slug: 'transporte', label: 'Transporte & Fletes' },
  { slug: 'logistica', label: 'Logística & Delivery' },
  { slug: 'articulos', label: 'E-Commerce & Artículos' },
];

export function CatalogSidebarFilters({
  filters,
  onChange,
  onApply,
  onReset,
  categoryCounts,
}: CatalogSidebarFiltersProps) {
  const toggleCategory = (slug: string) => {
    const exists = filters.categories.includes(slug);
    const updated = exists
      ? filters.categories.filter((c) => c !== slug)
      : [...filters.categories, slug];
    onChange({ categories: updated });
  };

  return (
    <aside className="w-full bg-surface-main border border-border-base rounded-2xl p-5 shadow-2xs space-y-6 text-left">
      {/* 1. Vertical de Negocio */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-content-main tracking-wider uppercase">
          Vertical de Negocio
        </h4>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const isChecked = filters.categories.includes(cat.slug);
            const count = categoryCounts[cat.slug] ?? 0;
            return (
              <label
                key={cat.slug}
                className="flex items-center justify-between text-xs text-content-main hover:text-brand transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(cat.slug)}
                    className="w-4 h-4 rounded text-brand border-border-base focus:ring-brand/30 cursor-pointer accent-brand"
                  />
                  <span>{cat.label}</span>
                </div>
                <span className="text-content-muted text-[11px] font-medium">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Rango de Precio (CLP) */}
      <div className="space-y-3 border-t border-border-base/70 pt-4">
        <h4 className="text-xs font-black text-content-main tracking-wider uppercase">
          Rango de Precio (CLP)
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.minPrice}
            onChange={(e) =>
              onChange({ minPrice: e.target.value === '' ? '' : Number(e.target.value) })
            }
            placeholder="5000"
            className="w-full h-9 px-3 text-xs bg-surface-base border border-border-base rounded-xl focus:outline-hidden focus:border-brand"
          />
          <span className="text-content-muted text-xs">-</span>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(e) =>
              onChange({ maxPrice: e.target.value === '' ? '' : Number(e.target.value) })
            }
            placeholder="100000"
            className="w-full h-9 px-3 text-xs bg-surface-base border border-border-base rounded-xl focus:outline-hidden focus:border-brand"
          />
        </div>
      </div>

      {/* 3. Garantía & Pago */}
      <div className="space-y-3 border-t border-border-base/70 pt-4">
        <h4 className="text-xs font-black text-content-main tracking-wider uppercase">
          Garantía & Pago
        </h4>
        <div className="space-y-2 text-xs text-content-main">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.escrowOnly}
              onChange={(e) => onChange({ escrowOnly: e.target.checked })}
              className="w-4 h-4 rounded text-brand border-border-base focus:ring-brand/30 cursor-pointer accent-brand"
            />
            <span>Custodia Escrow Activa</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => onChange({ verifiedOnly: e.target.checked })}
              className="w-4 h-4 rounded text-brand border-border-base focus:ring-brand/30 cursor-pointer accent-brand"
            />
            <span>Usuarios Verificados</span>
          </label>
        </div>
      </div>

      {/* 4. Botones de Acción */}
      <div className="space-y-2 border-t border-border-base/70 pt-4">
        <button
          type="button"
          onClick={onApply}
          className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
        >
          Actualizar Filtros
        </button>
        <button
          type="button"
          onClick={onReset}
          className="w-full text-center text-xs font-semibold text-content-muted hover:text-content-main py-1 transition-colors cursor-pointer"
        >
          Limpiar filtros
        </button>
      </div>
    </aside>
  );
}
