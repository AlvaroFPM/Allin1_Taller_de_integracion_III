'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { PublicationType } from '@/types/publication';

export interface PublicationTypeSelectorProps {
  value: PublicationType;
  onChange: (type: PublicationType) => void;
}

const TYPE_OPTIONS: {
  id: PublicationType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'TRABAJO',
    title: 'Solicitar Trabajo',
    subtitle: 'Busco a alguien para realizar un servicio',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    id: 'SERVICIO',
    title: 'Ofrecer Servicio',
    subtitle: 'Publica tus habilidades profesionales o técnicas',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    id: 'ARTICULO',
    title: 'Vender Artículo',
    subtitle: 'Vende productos nuevos, usados o herramientas',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
  },
];

export function PublicationTypeSelector({ value, onChange }: PublicationTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-black flex items-center justify-center shrink-0">
          1
        </span>
        <h3 className="text-sm sm:text-base font-bold text-content-main">
          Paso 1: ¿Qué tipo de publicación crearás?
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TYPE_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                'p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 select-none',
                isSelected
                  ? 'bg-brand/5 border-brand ring-2 ring-brand/20 shadow-xs'
                  : 'bg-surface-main border-border-base hover:border-brand/40 hover:bg-surface-base',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                  isSelected
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-surface-base text-content-muted',
                )}
              >
                {option.icon}
              </div>
              <div>
                <p
                  className={cn(
                    'text-xs sm:text-sm font-bold',
                    isSelected ? 'text-brand' : 'text-content-main',
                  )}
                >
                  {option.title}
                </p>
                <p className="text-[11px] text-content-muted mt-0.5 line-clamp-1">
                  {option.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
