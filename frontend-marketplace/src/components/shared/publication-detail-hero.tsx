'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PublicationDetailHeroProps {
  title: string;
  type?: 'TRABAJO' | 'SERVICIO' | 'ARTICULO';
  publishedRelative?: string;
  categoryName?: string;
  subcategoryName?: string;
  origin?: string;
  destination?: string;
}

export function PublicationDetailHero({
  title,
  type = 'TRABAJO',
  publishedRelative = 'Publicado hace 45 min',
  categoryName = 'Logística & Fletes',
  subcategoryName = 'Flete Urbano',
  origin = 'Ñuñoa',
  destination = 'La Florida',
}: PublicationDetailHeroProps) {
  return (
    <div className="space-y-4">
      {/* 1. Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center space-x-2 text-xs sm:text-sm text-content-muted"
      >
        <Link href="/" className="hover:text-brand transition-colors">
          Inicio
        </Link>
        <span className="text-border-base">/</span>
        <Link href="/explorar" className="hover:text-brand transition-colors">
          {categoryName}
        </Link>
        <span className="text-border-base">/</span>
        <span className="text-content-main font-medium truncate max-w-xs sm:max-w-md">
          {subcategoryName}
        </span>
      </nav>

      {/* 2. Badges de Tipo y Estado */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase',
            type === 'TRABAJO' && 'bg-emerald-100 text-emerald-900 border border-emerald-300',
            type === 'ARTICULO' && 'bg-purple-100 text-purple-900 border border-purple-300',
            type === 'SERVICIO' && 'bg-blue-100 text-blue-900 border border-blue-300',
          )}
        >
          {type === 'TRABAJO' && 'TRABAJO SOLICITADO'}
          {type === 'ARTICULO' && 'ARTÍCULO EN VENTA'}
          {type === 'SERVICIO' && 'SERVICIO OFRECIDO'}
        </span>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          Buscando Proveedor
        </span>

        <span className="text-xs text-content-muted">{publishedRelative}</span>
      </div>

      {/* 3. Título Principal */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-content-main tracking-tight leading-snug">
        {title}
      </h1>

      {/* 4. Trayecto / Visualización Logística (Mockup Boceto_DetallesPublicacion.png) */}
      <div className="aspect-video w-full rounded-2xl border border-dashed border-border-base bg-emerald-50/20 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Patrón de puntos geométricos de fondo */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#077A55 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Pin central y cápsula de ruta */}
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-white shadow-md border border-border-base flex items-center justify-center text-brand text-2xl">
            📍
          </div>

          <div className="inline-flex items-center gap-3 bg-white/95 backdrop-blur-xs border border-border-base/80 px-5 py-2.5 rounded-full shadow-xs">
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-content-main">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              {origin}
            </span>
            <span className="text-content-muted font-bold text-xs">→</span>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-content-main">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-dark inline-block" />
              {destination}
            </span>
          </div>

          <p className="text-xs text-content-muted max-w-sm">
            Trayecto de logística urbana verificado. El cálculo de kilometraje y ruta estimada se
            gestiona en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
