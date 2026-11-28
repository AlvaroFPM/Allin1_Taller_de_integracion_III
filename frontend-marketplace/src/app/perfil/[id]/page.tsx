'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PublicProfileHeader,
  PublicProfileReputation,
  PublicProfilePublications,
  PublicProfileReviews,
} from '@/components/shared';
import type { PublicProfilePublication } from '@/types/profile';
import type { SellerReview } from '@/types/review';
import { getPublicProfile } from '@/services/authService';
import { publicationService } from '@/services/publicationService';
import { orderExtrasService } from '@/services/orderExtrasService';
import { formatRelativeTime } from '@/lib/dateUtils';

interface SellerProfileState {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  bio?: string;
  city?: string;
  avatarUrl?: string;
}

type PageStatus = 'loading' | 'not-found' | 'success';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0] ? parts[0].slice(0, 2).toUpperCase() : '?';
}

function PublicProfileDetail({ id }: { id: string }) {
  const numericId = React.useMemo(() => {
    if (!/^\d+$/.test(id)) return null;
    const parsed = parseInt(id, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [id]);

  const [status, setStatus] = React.useState<PageStatus>(() =>
    numericId === null ? 'not-found' : 'loading',
  );
  const [seller, setSeller] = React.useState<SellerProfileState | null>(null);
  const [sellerPublications, setSellerPublications] = React.useState<PublicProfilePublication[]>(
    [],
  );
  const [isLoadingPubs, setIsLoadingPubs] = React.useState(() => numericId !== null);
  const [reviews, setReviews] = React.useState<SellerReview[]>([]);
  const [averageScore, setAverageScore] = React.useState<number>(0);

  React.useEffect(() => {
    if (numericId === null) {
      return;
    }

    const controller = new AbortController();

    // 1. Cargar datos de perfil público del vendedor desde IAM
    getPublicProfile(numericId, controller.signal)
      .then((profile) => {
        if (controller.signal.aborted) return;
        if (!profile || profile.userId !== numericId) {
          setStatus('not-found');
          setSeller(null);
          return;
        }

        const firstName = profile.firstName?.trim() || '';
        const lastName = profile.lastName?.trim() || '';
        const fullName =
          [firstName, lastName].filter(Boolean).join(' ').trim() || `Usuario #${numericId}`;
        const city =
          [profile.ciudad?.trim(), profile.region?.trim()].filter(Boolean).join(', ') || undefined;

        setSeller({
          id: String(numericId),
          firstName: firstName || `Usuario #${numericId}`,
          lastName,
          fullName,
          bio: profile.bioExperiencia?.trim() || undefined,
          city,
          avatarUrl: profile.fotoPerfilUrl?.trim() || undefined,
        });
        setStatus('success');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('not-found');
          setSeller(null);
        }
      });

    // 2. Cargar publicaciones reales del vendedor desde Catalog
    publicationService
      .getPublications({ userId: numericId, limit: 50 })
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res && res.publications) {
          const mapped: PublicProfilePublication[] = res.publications.map((p) => {
            const cat = (p.categorySlug || '').toLowerCase();
            let pubType: 'SERVICIO' | 'ARTICULO' | 'FLETE' = 'SERVICIO';
            if (cat.includes('flete') || cat.includes('transporte')) {
              pubType = 'FLETE';
            } else if (
              cat.includes('ropa') ||
              cat.includes('tec') ||
              cat.includes('mueble') ||
              cat.includes('mascota') ||
              cat.includes('articulo')
            ) {
              pubType = 'ARTICULO';
            }

            return {
              id: String(p.id),
              title: p.title,
              category: p.categoryName || 'General',
              price: p.price,
              currency: 'CLP',
              type: pubType,
            };
          });
          setSellerPublications(mapped);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Error al cargar publicaciones del vendedor:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingPubs(false);
        }
      });

    // 3. Cargar reseñas reales desde Orders y enriquecer autores y títulos
    orderExtrasService
      .getUserReviews(numericId, controller.signal)
      .then(async (res) => {
        if (controller.signal.aborted) return;
        setAverageScore(res.averageScore);

        if (res.reviews.length === 0) {
          setReviews([]);
          return;
        }

        const authorIds = Array.from(new Set(res.reviews.map((r) => r.idUsuarioAutor)));
        const pubIds = Array.from(new Set(res.reviews.map((r) => r.idPublicacion)));

        const [authors, pubs] = await Promise.all([
          Promise.all(
            authorIds.map(async (uid) => {
              const p = await getPublicProfile(uid, controller.signal);
              return [uid, p] as const;
            }),
          ),
          Promise.all(
            pubIds.map(async (pid) => {
              try {
                const p = await publicationService.getPublicationById(
                  String(pid),
                  controller.signal,
                );
                return [pid, p] as const;
              } catch {
                return [pid, null] as const;
              }
            }),
          ),
        ]);

        if (controller.signal.aborted) return;

        const authorMap = new Map(authors);
        const pubMap = new Map(pubs);

        const mappedReviews: SellerReview[] = res.reviews.map((rev) => {
          const authorProfile = authorMap.get(rev.idUsuarioAutor);
          const authorName = authorProfile
            ? [authorProfile.firstName, authorProfile.lastName]
                .map((s) => s?.trim() ?? '')
                .filter(Boolean)
                .join(' ') || `Usuario #${rev.idUsuarioAutor}`
            : `Usuario #${rev.idUsuarioAutor}`;
          const pub = pubMap.get(rev.idPublicacion);

          return {
            id: String(rev.idReview),
            sellerId: String(rev.idUsuarioEvaluado),
            authorName,
            authorInitials: getInitials(authorName),
            authorAvatarUrl: authorProfile?.fotoPerfilUrl || undefined,
            rating: rev.rating,
            comment: rev.comentario || 'Sin comentario adicional.',
            createdAt: formatRelativeTime(rev.createdAt),
            serviceTitle: pub?.title || `Publicación #${rev.idPublicacion}`,
            verifiedPurchase: true,
          };
        });

        setReviews(mappedReviews);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setReviews([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [numericId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-base py-16 flex items-center justify-center">
        <div role="status" className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-content-muted">
            Cargando perfil del vendedor...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'not-found' || !seller) {
    return (
      <div className="min-h-screen bg-surface-base py-16">
        <div className="max-w-md mx-auto px-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-surface-main border border-border-base flex items-center justify-center mx-auto text-content-muted shadow-xs">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-content-main">Vendedor no encontrado</h1>
          <p className="text-xs text-content-muted">
            El perfil de vendedor solicitado no existe o no se pudo cargar su información desde el
            sistema.
          </p>
          <div>
            <Link
              href="/explorar"
              className="inline-flex items-center text-xs font-bold text-brand hover:underline"
            >
              ← Explorar publicaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-content-muted flex items-center gap-1.5">
          <Link href="/" className="hover:text-brand transition-colors">
            Inicio
          </Link>
          <span>/</span>
          <Link href="/explorar" className="hover:text-brand transition-colors">
            Explorar
          </Link>
          <span>/</span>
          <span>Perfil de vendedor</span>
          <span>/</span>
          <span className="text-content-main font-semibold">{seller.fullName}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Columna izquierda — Header + Reputación real */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">
            <PublicProfileHeader
              firstName={seller.firstName}
              lastName={seller.lastName}
              bio={seller.bio}
              isVerified={false}
              avatarUrl={seller.avatarUrl}
              city={seller.city}
              contactDisabled={true}
            />
            <PublicProfileReputation
              available={reviews.length > 0}
              score={averageScore}
              totalReviews={reviews.length}
            />
          </div>

          {/* Columna derecha — Publicaciones reales y Reseñas reales */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            <PublicProfilePublications
              sellerName={seller.firstName}
              publications={sellerPublications}
              isLoading={isLoadingPubs}
            />
            <PublicProfileReviews
              sellerName={seller.firstName}
              reviews={reviews}
              averageScore={averageScore}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const rawId = typeof params?.id === 'string' ? params.id : '';

  return <PublicProfileDetail key={rawId} id={rawId} />;
}
