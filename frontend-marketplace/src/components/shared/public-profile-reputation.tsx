'use client';

import * as React from 'react';

export interface PublicProfileReputationProps {
  score?: number;
  totalReviews?: number;
  responseTime?: string;
  completionRate?: number;
}

export function PublicProfileReputation({
  score = 4.9,
  totalReviews = 28,
  responseTime = '< 15 min',
  completionRate = 98,
}: PublicProfileReputationProps) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">Reputación</h3>

      {/* Score + Estrellas */}
      <div className="flex items-center gap-4">
        <span className="text-5xl font-black text-content-main tracking-tight leading-none">
          {score.toFixed(1)}
        </span>

        <div className="space-y-1.5">
          {/* Estrellas */}
          <div className="flex items-center gap-0.5 text-emerald-600">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= fullStars;
              const half = !filled && star === fullStars + 1 && hasHalf;
              return (
                <svg
                  key={star}
                  className={`w-5 h-5 ${filled || half ? 'fill-current' : 'text-border-base fill-current'}`}
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              );
            })}
          </div>
          <p className="text-xs text-content-muted font-medium">
            {totalReviews} reseñas completadas
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="pt-4 border-t border-border-base/70 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-content-muted flex items-center gap-1.5">
            <span className="text-emerald-600">✓</span>
            Tasa de completitud
          </span>
          <span className="font-bold text-content-main">{completionRate}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-content-muted flex items-center gap-1.5">
            <span className="text-emerald-600">✓</span>
            Tiempo de respuesta
          </span>
          <span className="font-bold text-content-main">{responseTime}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-content-muted flex items-center gap-1.5">
            <span className="text-emerald-600">✓</span>
            Transacciones con Escrow
          </span>
          <span className="font-bold text-content-main">100%</span>
        </div>
      </div>
    </div>
  );
}
