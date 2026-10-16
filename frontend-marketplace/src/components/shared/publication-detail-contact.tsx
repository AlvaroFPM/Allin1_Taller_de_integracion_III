'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

export interface PublicationDetailContactProps {
  sellerId?: number;
  sellerName?: string;
  avatarInitials?: string;
  rating?: number;
  reviewsCount?: number;
  verifiedKYC?: boolean;
  responseTime?: string;
  completedJobs?: number;
  onSendMessage?: () => void;
}

export function PublicationDetailContact({
  sellerId = 104,
  sellerName = 'Nicolas',
  avatarInitials = 'EA',
  rating = 4.9,
  reviewsCount = 34,
  verifiedKYC = true,
  responseTime = '< 15 min',
  completedJobs = 18,
  onSendMessage,
}: PublicationDetailContactProps) {
  return (
    <div className="bg-surface-main border border-border-base rounded-3xl p-6 sm:p-8 shadow-2xs space-y-5">
      {/* Usuario / Solicitante */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-lg flex items-center justify-center shrink-0">
          {avatarInitials}
        </div>

        <div className="space-y-1 truncate">
          <h3 className="font-bold text-base text-content-main truncate">{sellerName}</h3>
          {verifiedKYC && (
            <span className="inline-flex items-center text-xs font-semibold text-emerald-800">
              <span className="mr-1">✓</span> Identidad Verificada (KYC)
            </span>
          )}
        </div>
      </div>

      {/* Calificación y Estrellas doradas (Boceto_DetallesPublicacion.png) */}
      <div className="flex items-center gap-2 text-xs border-y border-border-base/70 py-3">
        <div className="flex text-amber-500 text-sm">
          {'★'.repeat(Math.round(rating))}
          {'☆'.repeat(5 - Math.round(rating))}
        </div>
        <span className="font-extrabold text-content-main">{rating}</span>
        <span className="text-content-muted">({reviewsCount} reseñas)</span>
      </div>

      {/* Métricas rápidas de confianza */}
      <div className="grid grid-cols-2 gap-3 text-xs text-content-muted">
        <div>
          <span className="block font-medium">Respuesta:</span>
          <span className="font-bold text-content-main">{responseTime}</span>
        </div>
        <div>
          <span className="block font-medium">Completados:</span>
          <span className="font-bold text-content-main">{completedJobs} trabajos</span>
        </div>
      </div>

      {/* Botón: Enviar Mensaje */}
      <Button
        variant="secondary"
        size="md"
        fullWidth
        onClick={onSendMessage}
        className="font-bold cursor-pointer"
      >
        Enviar Mensaje
      </Button>

      {/* Enlace al perfil público */}
      <div className="text-center pt-1">
        <Link
          href={`/perfil/${sellerId}`}
          className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
        >
          Ver Perfil Público del Usuario →
        </Link>
      </div>
    </div>
  );
}
