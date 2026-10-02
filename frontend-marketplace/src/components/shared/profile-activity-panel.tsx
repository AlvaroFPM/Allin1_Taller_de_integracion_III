'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_ACTIVITIES, type ProfileActivityFilter } from '@/types/profile';

export function ProfileActivityPanel() {
  const [activeFilter, setActiveFilter] = React.useState<ProfileActivityFilter>('ALL');

  const filteredItems = React.useMemo(() => {
    if (activeFilter === 'ALL') return DEFAULT_ACTIVITIES;
    return DEFAULT_ACTIVITIES.filter((item) => item.type === activeFilter);
  }, [activeFilter]);

  return (
    <div className="space-y-6">
      {/* Cabecera del Panel */}
      <div className="bg-surface-main rounded-2xl border border-border-base p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-main tracking-tight">
            Panel de Actividad y Publicaciones
          </h2>
          <p className="text-xs text-content-muted mt-1">
            Historial centralizado de solicitudes, trabajos y artículos
          </p>
        </div>

        <Link href="/publicar" className="shrink-0">
          <Button variant="primary" size="sm">
            + Publicar Solicitud / Venta
          </Button>
        </Link>
      </div>

      {/* Pestañas de Filtro */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(
          [
            { key: 'ALL', label: `Todo el Historial (${DEFAULT_ACTIVITIES.length})` },
            { key: 'SOLICITUD', label: 'Solicitud Creada (1)' },
            { key: 'TRABAJO', label: 'Trabajo Aceptado (1)' },
            { key: 'ARTICULO', label: 'Artículos en Venta (1)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3.5 py-2 rounded-xl font-semibold transition-colors cursor-pointer shrink-0 ${
              activeFilter === tab.key
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-surface-main text-content-muted hover:text-content-main border border-border-base'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listado de Tarjetas */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-surface-main rounded-2xl border border-border-base p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {item.typeLabel}
                </span>
                <span className="text-content-muted">• {item.category}</span>
              </div>

              <h3 className="text-base font-bold text-content-main">{item.title}</h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
                <Badge variant="brand" size="sm">
                  {item.statusBadge}
                </Badge>
                <span>{item.location}</span>
                <span>{item.dateRelative}</span>
              </div>
            </div>

            <div className="flex flex-col md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border-base shrink-0">
              <div className="text-left md:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                  {item.priceLabel}
                </span>
                <span className="text-xl font-black text-emerald-700">
                  ${item.price.toLocaleString('es-CL')} CLP
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm">
                  Ver Detalles
                </Button>
                <Button variant="ghost" size="sm">
                  Editar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
