'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PublicationDetailHeroProps {
  title: string;
  type?: string;
  publishedRelative?: string;
  categoryName?: string;
  subcategoryName?: string;
  origin?: string;
  destination?: string;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'TRABAJO':
      return 'TRABAJO SOLICITADO';
    case 'ARTICULO':
      return 'ARTÍCULO EN VENTA';
    case 'SERVICIO':
      return 'SERVICIO OFRECIDO';
    default:
      return type;
  }
}

export function PublicationDetailHero({
  title,
  type,
  publishedRelative,
  categoryName,
  subcategoryName,
  origin,
  destination,
}: PublicationDetailHeroProps) {
  return (
    <div className="space-y-4">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs text-content-muted sm:text-sm"
      >
        <Link href="/" className="hover:text-brand transition-colors">
          Inicio
        </Link>

        <span className="text-border-base">/</span>

        <Link href="/explorar" className="hover:text-brand transition-colors">
          {categoryName || 'Explorar'}
        </Link>

        {subcategoryName && (
          <>
            <span className="text-border-base">/</span>
            <span className="max-w-xs truncate font-medium text-content-main sm:max-w-md">
              {subcategoryName}
            </span>
          </>
        )}
      </nav>

      <div className="flex flex-wrap items-center gap-2.5">
        {type && (
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-extrabold tracking-wide uppercase',
              type === 'TRABAJO'
                ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                : type === 'ARTICULO'
                  ? 'border-purple-300 bg-purple-100 text-purple-900'
                  : type === 'SERVICIO'
                    ? 'border-blue-300 bg-blue-100 text-blue-900'
                    : 'border-border-base bg-surface-main text-content-main',
            )}
          >
            {getTypeLabel(type)}
          </span>
        )}

        {publishedRelative && (
          <span className="text-xs text-content-muted">{publishedRelative}</span>
        )}
      </div>

      <h1 className="text-2xl leading-snug font-extrabold tracking-tight text-content-main sm:text-3xl lg:text-4xl">
        {title}
      </h1>

      {origin && destination && (
        <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-base bg-emerald-50/20 p-6 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(#077A55 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center space-y-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border-base bg-white text-2xl text-brand shadow-md"
            >
              📍
            </div>

            <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-border-base/80 bg-white/95 px-5 py-2.5 shadow-xs">
              <span className="text-xs font-bold text-content-main sm:text-sm">{origin}</span>
              <span className="text-content-muted">→</span>
              <span className="text-xs font-bold text-content-main sm:text-sm">{destination}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
