'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PublicationDetailGalleryProps {
  images: string[];
  title: string;
}

export function PublicationDetailGallery({ images, title }: PublicationDetailGalleryProps) {
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Visor Principal: altura equilibrada + object-contain + fondo ambiental difuminado */}
      <div className="relative h-[340px] sm:h-[420px] w-full rounded-2xl overflow-hidden bg-surface-base border border-border-base flex items-center justify-center">
        {/* Fondo difuminado sutil para rellenar bordes en fotos cuadradas o verticales */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[selectedIdx]}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30 pointer-events-none select-none"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[selectedIdx]}
          alt={`${title} - Imagen ${selectedIdx + 1}`}
          className="relative z-10 w-full h-full object-contain p-2 drop-shadow-xs"
        />
        {images.length > 1 && (
          <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-md">
            {selectedIdx + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Miniaturas (Soporta 1 a 5 imágenes según la regla de negocio RN-25) */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((imgUrl, idx) => (
            <button
              key={imgUrl}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-surface-base flex items-center justify-center p-0.5',
                selectedIdx === idx
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'border-border-base hover:border-brand/60 opacity-80 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
