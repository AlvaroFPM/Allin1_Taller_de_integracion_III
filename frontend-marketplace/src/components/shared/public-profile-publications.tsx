'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { Spinner } from '@/components/ui/spinner';
import type { PublicProfilePublication } from '@/types/profile';

export type { PublicProfilePublication };

export interface PublicProfilePublicationsProps {
  publications?: PublicProfilePublication[];
  sellerName?: string;
  isLoading?: boolean;
}

const TYPE_VARIANT: Record<PublicProfilePublication['type'], 'brand' | 'warning' | 'neutral'> = {
  SERVICIO: 'brand',
  FLETE: 'neutral',
  ARTICULO: 'warning',
};

export function PublicProfilePublications({
  publications,
  sellerName = 'este vendedor',
  isLoading = false,
}: PublicProfilePublicationsProps) {
  if (isLoading) {
    return (
      <div className="bg-surface-main rounded-3xl border border-border-base p-8 shadow-xs flex flex-col items-center justify-center gap-3">
        <Spinner size="sm" variant="brand" />
        <p className="text-xs text-content-muted">Cargando publicaciones activas del vendedor...</p>
      </div>
    );
  }

  const items = publications ?? [];

  if (items.length === 0) {
    return (
      <div className="bg-surface-main rounded-3xl border border-border-base p-8 shadow-xs text-center text-content-muted text-sm space-y-2">
        <div className="text-2xl">📦</div>
        <p>{sellerName} aún no tiene publicaciones activas en la base de datos.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">
        Publicaciones Activas
        <span className="ml-2 text-brand font-black">({items.length})</span>
      </h3>

      <ul className="space-y-3">
        {items.map((pub) => (
          <li
            key={pub.id}
            className="p-4 rounded-2xl border border-border-base/80 hover:border-brand/30 hover:shadow-xs transition-all bg-surface-base/30"
          >
            <Link
              href={`/catalogo/${pub.id}`}
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
