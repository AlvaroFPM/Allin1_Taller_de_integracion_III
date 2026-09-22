'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CreatePublicationFormState } from '@/types/publication';

export interface PublicationLivePreviewProps {
  formState: CreatePublicationFormState;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export function PublicationLivePreview({
  formState,
  onSubmit,
  isSubmitting = false,
}: PublicationLivePreviewProps) {
  const { tipo, titulo, descripcion, ubicacion, moneda, precioBase } = formState;

  // Badge según el tipo
  const badgeConfig = {
    TRABAJO: { label: 'TRABAJO SOLICITADO', variant: 'brand' as const },
    SERVICIO: { label: 'SERVICIO OFRECIDO', variant: 'brand' as const },
    ARTICULO: { label: 'ARTÍCULO EN VENTA', variant: 'neutral' as const },
  }[tipo];

  const formattedPrice =
    precioBase && !isNaN(Number(precioBase)) && Number(precioBase) > 0
      ? `$ ${Number(precioBase).toLocaleString('es-CL')} ${moneda}`
      : '$ No especificado';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-black flex items-center justify-center shrink-0">
          3
        </span>
        <h3 className="text-sm sm:text-base font-bold text-content-main">
          Paso 3: Revisa y Publica
        </h3>
      </div>

      {/* Tarjeta de Vista Previa en Vivo */}
      <div className="rounded-3xl border border-border-base bg-surface-main p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-base/70 pb-3">
          <span className="text-sm font-bold text-content-main">Vista Previa</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-content-muted">
            Hace 1 min
          </span>
        </div>

        <div className="space-y-2.5 text-left">
          <Badge variant={badgeConfig.variant} size="sm">
            {badgeConfig.label}
          </Badge>

          <h4 className="text-base sm:text-lg font-bold text-content-main line-clamp-2 leading-snug">
            {titulo.trim() || 'Sin título aún'}
          </h4>

          <p className="text-xs text-content-muted line-clamp-3 italic leading-relaxed">
            {descripcion.trim() || '"Sin descripción detallada..."'}
          </p>
        </div>

        {/* Metadatos: Ubicación y Presupuesto */}
        <div className="pt-3 border-t border-border-base/60 grid grid-cols-2 gap-3 text-left">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-content-muted">
              Ubicación
            </p>
            <p className="text-xs font-semibold text-content-main mt-0.5 flex items-center gap-1">
              <span>📍</span>
              <span className="truncate">{ubicacion || 'Por definir'}</span>
            </p>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-content-muted">
              Presupuesto
            </p>
            <p className="text-xs font-bold text-brand mt-0.5 truncate">{formattedPrice}</p>
          </div>
        </div>

        {/* Indicador de multimedia */}
        <div className="flex items-center gap-1.5 text-[11px] text-content-muted pt-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>0 imágenes adjuntas</span>
        </div>

        {/* Acciones */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            isLoading={isSubmitting}
            onClick={onSubmit}
            className="font-bold shadow-md hover:shadow-lg transition-all"
          >
            Publicar Solicitud / Venta →
          </Button>

          <button
            type="button"
            onClick={() => alert('Borrador guardado localmente.')}
            className="w-full text-center text-xs font-medium text-content-muted hover:text-content-main py-1.5 transition-colors cursor-pointer"
          >
            Guardar Borrador
          </button>
        </div>
      </div>

      {/* Tarjeta Informativa: Consejo de Venta */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3 text-left">
        <div className="w-7 h-7 rounded-lg bg-emerald-200/60 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          <p className="font-bold text-emerald-950">Consejo de Venta</p>
          <p className="mt-0.5 text-emerald-800 leading-relaxed text-[11px]">
            Las publicaciones con imágenes reales y descripciones claras reciben hasta un{' '}
            <span className="font-bold">80% más de respuestas</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
