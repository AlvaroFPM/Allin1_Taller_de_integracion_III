'use client';

import * as React from 'react';

export interface PublicProfileReputationProps {
  score?: number;
  totalReviews?: number;
  available?: boolean;
}

export function PublicProfileReputation({
  score,
  totalReviews = 0,
  available = false,
}: PublicProfileReputationProps) {
  if (!available || score == null || totalReviews <= 0) {
    return (
      <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">Reputación</h3>
        <p className="text-xs text-content-muted leading-relaxed">
          Este usuario aún no registra calificaciones de órdenes completadas.
        </p>
      </div>
    );
  }

  const fullStars = Math.round(score);

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-content-main">Reputación</h3>

      <div className="flex items-center gap-4">
        <span className="text-5xl font-black text-content-main tracking-tight leading-none">
          {score.toFixed(1)}
        </span>

        <div className="space-y-1.5">
          <div className="flex items-center gap-0.5 text-amber-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-5 h-5 fill-current ${
                  star <= fullStars ? 'text-amber-500' : 'text-border-base'
                }`}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-xs text-content-muted font-medium">
            {totalReviews} {totalReviews === 1 ? 'reseña verificada' : 'reseñas verificadas'}
          </p>
        </div>
      </div>
    </div>
  );
}
