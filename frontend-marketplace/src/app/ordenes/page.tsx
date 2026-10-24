'use client';

import * as React from 'react';
import Link from 'next/link';
import { OrdersDashboardPanel } from '@/components/shared';

export default function OrdenesPage() {
  return (
    <div className="min-h-screen bg-surface-base py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="text-xs text-content-muted flex items-center gap-1.5">
          <Link href="/" className="hover:text-brand transition-colors">
            Inicio
          </Link>
          <span>/</span>
          <span>Panel de Usuario</span>
          <span>/</span>
          <span className="text-content-main font-semibold">Dashboard de Órdenes</span>
        </nav>

        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-base">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-main tracking-tight">
              Dashboard de Órdenes
            </h1>
            <p className="text-xs sm:text-sm text-content-muted mt-1 max-w-2xl">
              Supervisa tus compras contratadas y tus ventas como proveedor, con pagos protegidos
              bajo custodia Escrow.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href="/catalogo">
              <span className="inline-flex items-center justify-center text-xs font-bold text-brand hover:underline px-3 py-2">
                Explorar Catálogo →
              </span>
            </Link>
          </div>
        </div>

        {/* Panel Interactivo con Pestañas y Filtros */}
        <OrdersDashboardPanel />
      </div>
    </div>
  );
}
