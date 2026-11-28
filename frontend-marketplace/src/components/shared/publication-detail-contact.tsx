'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export interface PublicationDetailContactProps {
  sellerId?: number;
  sellerName?: string;
  avatarUrl?: string;
  avatarInitials?: string;
  rating?: number;
  reviewsCount?: number;
  verifiedKYC?: boolean;
  isOwnPublication?: boolean;
  onSendMessage?: () => void;
}

function computeInitials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function PublicationDetailContact({
  sellerId,
  sellerName,
  avatarUrl,
  avatarInitials,
  rating,
  reviewsCount,
  verifiedKYC,
  isOwnPublication = false,
  onSendMessage,
}: PublicationDetailContactProps) {
  const hasSellerId = typeof sellerId === 'number' && Number.isInteger(sellerId) && sellerId > 0;

  const displayName = sellerName?.trim() || (hasSellerId ? `Usuario #${sellerId}` : 'Vendedor');
  const initials = avatarInitials?.trim() || computeInitials(sellerName);

  const validReviewsCount =
    typeof reviewsCount === 'number' && Number.isInteger(reviewsCount) && reviewsCount >= 0
      ? reviewsCount
      : null;

  const validRating =
    typeof rating === 'number' &&
    Number.isFinite(rating) &&
    rating > 0 &&
    rating <= 5 &&
    (validReviewsCount === null || validReviewsCount > 0)
      ? rating
      : null;

  return (
    <div className="space-y-5 rounded-3xl border border-border-base bg-surface-main p-6 shadow-2xs sm:p-8">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-14 w-14 shrink-0 rounded-full border border-emerald-300 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-lg font-extrabold text-emerald-900">
            {initials}
          </div>
        )}

        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-bold text-content-main">{displayName}</h3>

          {verifiedKYC === true && (
            <span className="inline-flex items-center text-xs font-semibold text-emerald-800">
              <span className="mr-1">✓</span>
              Identidad Verificada (KYC)
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-border-base/70 py-3 text-xs">
        {validRating !== null ? (
          <>
            <div aria-hidden="true" className="flex text-sm text-amber-500">
              {'★'.repeat(Math.round(validRating))}
              {'☆'.repeat(5 - Math.round(validRating))}
            </div>

            <span className="font-extrabold text-content-main">{validRating.toFixed(1)} / 5</span>

            {validReviewsCount !== null && (
              <span className="text-content-muted">
                ({validReviewsCount} {validReviewsCount === 1 ? 'reseña' : 'reseñas'})
              </span>
            )}
          </>
        ) : (
          <span className="text-content-muted">Sin calificaciones aún</span>
        )}
      </div>

      {!isOwnPublication && (
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={onSendMessage}
          disabled={!onSendMessage}
          className="font-bold"
        >
          Enviar Mensaje
        </Button>
      )}

      {hasSellerId && (
        <div className="pt-1 text-center">
          <Link
            href={`/perfil/${sellerId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Ver Perfil Público del Usuario →
          </Link>
        </div>
      )}
    </div>
  );
}
