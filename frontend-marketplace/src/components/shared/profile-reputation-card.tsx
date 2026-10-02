'use client';

import * as React from 'react';

export interface ProfileReputationCardProps {
  score?: number;
  totalReviews?: number;
}

export function ProfileReputationCard({
  score = 4.9,
  totalReviews = 28,
}: ProfileReputationCardProps) {
  return (
    <div className="bg-surface-main rounded-2xl border border-border-base p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">
        Reputación del Usuario
      </h3>

      <div className="flex items-center gap-4">
        <span className="text-4xl font-black text-content-main tracking-tight leading-none">
          {score.toFixed(1)}
        </span>

        <div className="space-y-1">
          {/* Estrellas Verdes */}
          <div className="flex items-center gap-0.5 text-emerald-600">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg key={star} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-xs text-content-muted font-medium">
            {totalReviews} reseñas completadas
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-border-base/70 space-y-2 text-[11px] text-content-muted">
        <div className="flex items-center gap-2">
          <span className="text-emerald-600">✓</span>
          <span>100% de transacciones con Escrow protegidas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600">✓</span>
          <span>Tiempo de respuesta promedio: &lt; 15 min</span>
        </div>
      </div>
    </div>
  );
}
