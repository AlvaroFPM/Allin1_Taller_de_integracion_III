import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicationCardSkeleton } from '@/components/shared/publication-card-skeleton';

export default function ExplorarLoading() {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* 1. Encabezado de Búsqueda y Pestañas Skeleton */}
      <div className="bg-surface-main border border-border-base rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>

        {/* Input de Búsqueda y selector de comuna */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Skeleton className="h-10 sm:col-span-2 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>

        {/* Pestañas Skeleton */}
        <div className="flex gap-2 pt-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
        </div>
      </div>

      {/* 2. Cuerpo: Sidebar Skeleton + Grilla de Publicaciones Skeleton */}
      <div className="flex flex-col md:flex-row items-start gap-6 lg:gap-8">
        {/* Sidebar Desktop Skeleton */}
        <div className="hidden md:block w-64 lg:w-72 shrink-0 bg-surface-main border border-border-base rounded-2xl p-5 space-y-5">
          <div className="space-y-2 pb-3 border-b border-border-base/60">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-36 rounded-sm" />
          </div>

          {/* Categorías simuladas */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 rounded-sm" />
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-3.5 w-24 rounded-sm" />
                  </div>
                  <Skeleton className="h-3.5 w-6 rounded-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Rango de precio simulado */}
          <div className="space-y-3 pt-3 border-t border-border-base/60">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 rounded-xl" />
              <Skeleton className="h-9 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Grilla de Skeletons */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <PublicationCardSkeleton key={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
