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
      {/* Visor Principal */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border border-border-base flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[selectedIdx]}
          alt={`${title} - Imagen ${selectedIdx + 1}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-md">
          {selectedIdx + 1} / {images.length}
        </div>
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
                'relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer',
                selectedIdx === idx
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'border-border-base hover:border-brand/60 opacity-80 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
