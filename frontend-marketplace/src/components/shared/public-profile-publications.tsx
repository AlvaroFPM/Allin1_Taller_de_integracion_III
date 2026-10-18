'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { PublicProfilePublication } from '@/types/profile';

export type { PublicProfilePublication };

export interface PublicProfilePublicationsProps {
  publications?: PublicProfilePublication[];
  sellerName?: string;
}

const MOCK_PUBLICATIONS: PublicProfilePublication[] = [
  {
    id: 'pub-2',
    title: 'Flete: Traslado de Sillón y 4 Cajas',
    category: 'Transporte & Fletes',
    price: 28000,
    type: 'FLETE',
  },
  {
    id: 'pub-3',
    title: 'Reparación de Cañería Filtrada en Cocina',
    category: 'Mantenimiento del Hogar',
    price: 35000,
    type: 'SERVICIO',
  },
  {
    id: 'pub-4',
    title: 'Set de Herramientas Multiuso 48 Piezas',
    category: 'Herramientas',
    price: 18990,
    type: 'ARTICULO',
  },
];

const TYPE_VARIANT: Record<PublicProfilePublication['type'], 'brand' | 'warning' | 'neutral'> = {
  SERVICIO: 'brand',
  FLETE: 'neutral',
  ARTICULO: 'warning',
};

export function PublicProfilePublications({
  publications = MOCK_PUBLICATIONS,
  sellerName = 'este vendedor',
}: PublicProfilePublicationsProps) {
  if (publications.length === 0) {
    return (
      <div className="bg-surface-main rounded-3xl border border-border-base p-8 shadow-xs text-center text-content-muted text-sm">
        {sellerName} aún no tiene publicaciones activas.
      </div>
    );
  }

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">
        Publicaciones Activas
        <span className="ml-2 text-brand font-black">({publications.length})</span>
      </h3>

      <ul className="space-y-3">
        {publications.map((pub) => (
          <li
            key={pub.id}
            className="p-4 rounded-2xl border border-border-base/80 hover:border-brand/30 hover:shadow-xs transition-all bg-surface-base/30"
          >
            <Link
              href={`/publicaciones/${pub.id}`}
              className="flex items-center justify-between gap-4 group"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={TYPE_VARIANT[pub.type]} size="sm">
                    {pub.type}
                  </Badge>
                  <span className="text-[11px] text-content-muted font-medium">{pub.category}</span>
                </div>
                <p className="text-sm font-semibold text-content-main truncate group-hover:text-brand transition-colors">
                  {pub.title}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black text-brand">
                  ${pub.price.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-content-muted">{pub.currency ?? 'CLP'}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
