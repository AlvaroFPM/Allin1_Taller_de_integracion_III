'use client';

import * as React from 'react';
import { Rating } from '@/components/ui/rating';
import { Badge } from '@/components/ui/badge';
import { MOCK_SELLER_REVIEWS, type SellerReview } from '@/types/review';

export interface PublicProfileReviewsProps {
  reviews?: SellerReview[];
  sellerName?: string;
  averageScore?: number;
}

export function PublicProfileReviews({
  reviews = MOCK_SELLER_REVIEWS,
  sellerName = 'este vendedor',
  averageScore = 4.9,
}: PublicProfileReviewsProps) {
  const [selectedFilter, setSelectedFilter] = React.useState<number | 'ALL'>('ALL');

  const filteredReviews = React.useMemo(() => {
    if (selectedFilter === 'ALL') return reviews;
    return reviews.filter((r) => r.rating === selectedFilter);
  }, [reviews, selectedFilter]);

  const totalReviewsCount = reviews.length;

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-6">
      {/* Cabecera y Resumen de Reputación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-base/70">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-content-main tracking-tight flex items-center gap-2">
            Opiniones y Reseñas de Clientes
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-base font-extrabold text-brand border border-border-base">
              {totalReviewsCount}
            </span>
          </h3>
          <p className="text-xs text-content-muted mt-0.5">
            Calificaciones reales de clientes tras completar trabajos y compras con Escrow
          </p>
        </div>

        {totalReviewsCount > 0 && (
          <div className="flex items-center gap-3 bg-surface-base/60 px-3.5 py-2 rounded-2xl border border-border-base/70 self-start sm:self-auto shrink-0">
            <Rating value={averageScore} readOnly size="md" showValue />
          </div>
        )}
      </div>

      {/* Píldoras de Filtro por Estrellas */}
      {totalReviewsCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
              selectedFilter === 'ALL'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                : 'bg-surface-main text-content-muted hover:text-content-main border border-border-base'
            }`}
          >
            Todas ({totalReviewsCount})
          </button>
          {[5, 4, 3].map((stars) => {
            const count = reviews.filter((r) => r.rating === stars).length;
            if (count === 0 && selectedFilter !== stars) return null;
            return (
              <button
                key={stars}
                type="button"
                onClick={() => setSelectedFilter(stars)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedFilter === stars
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                    : 'bg-surface-main text-content-muted hover:text-content-main border border-border-base'
                }`}
              >
                {stars} ★ ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Listado de Reseñas */}
      {filteredReviews.length > 0 ? (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <article
              key={review.id}
              className="p-5 rounded-2xl border border-border-base/80 bg-surface-base/30 space-y-3 transition-all hover:border-brand/30 hover:shadow-2xs"
            >
              {/* Fila Superior: Autor, Verificación y Fecha */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {review.authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.authorAvatarUrl}
                      alt={review.authorName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs select-none shadow-2xs">
                      {review.authorInitials}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-content-main leading-tight">
                      {review.authorName}
                    </h4>
                    {review.verifiedPurchase && (
                      <span className="text-[10px] text-emerald-800 font-semibold inline-flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Transacción Verificada
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-content-muted font-medium">
                  {review.createdAt}
                </span>
              </div>

              {/* Fila Media: Estrellas y Etiqueta del Servicio */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <Rating value={review.rating} readOnly size="sm" />
                <Badge variant="neutral" size="sm" className="text-[11px]">
                  {review.serviceTitle}
                </Badge>
              </div>

              {/* Comentario del Cliente */}
              <p className="text-xs sm:text-sm text-content-main/90 leading-relaxed">
                &ldquo;{review.comment}&rdquo;
              </p>
            </article>
          ))}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="p-8 rounded-2xl border border-dashed border-border-base text-center space-y-1">
          <p className="text-sm font-semibold text-content-main">
            No se encontraron opiniones con este filtro
          </p>
          <p className="text-xs text-content-muted">
            {reviews.length === 0
              ? `${sellerName} aún no ha recibido reseñas en la plataforma.`
              : 'Prueba seleccionando otra calificación en los filtros superiores.'}
          </p>
        </div>
      )}
    </div>
  );
}
