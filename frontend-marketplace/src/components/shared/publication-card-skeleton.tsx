import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function PublicationCardSkeleton() {
  return (
    <article
      aria-label="Cargando publicación"
      className="bg-surface-main border border-border-base rounded-2xl p-5 shadow-2xs flex flex-col justify-between text-left gap-4 select-none"
    >
      {/* Cabecera: Badge de tipo y fecha relativa */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-3.5 w-20 rounded-md" />
      </div>

      {/* Contenido: Título y descripción */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <div className="space-y-1.5 pt-0.5">
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
        </div>
      </div>

      {/* Caja de Detalles Técnicos / Logísticos */}
      <div className="bg-surface-base border border-border-base/70 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20 rounded-sm" />
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>
        <div className="flex items-center justify-between border-t border-border-base/40 pt-1.5">
          <Skeleton className="h-3 w-16 rounded-sm" />
          <Skeleton className="h-3 w-24 rounded-sm" />
        </div>
      </div>

      {/* Pie de tarjeta: Precio y botón de acción */}
      <div className="flex items-end justify-between gap-3 pt-1 border-t border-border-base/40">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-24 rounded-sm" />
          <Skeleton className="h-6 w-32 rounded-lg" />
        </div>

        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </article>
  );
}
