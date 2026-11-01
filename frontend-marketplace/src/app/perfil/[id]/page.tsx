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
import type { PublicProfilePublication, PublicSellerProfile } from '@/types/profile';
import { MOCK_SELLER_REVIEWS } from '@/types/review';
import { getPublicProfile } from '@/services/authService';
import { publicationService } from '@/services/publicationService';

/* -----------------------------------------------------------------------
 * Datos mock de respaldo si el perfil no existe en IAM
 * --------------------------------------------------------------------- */

const MOCK_SELLERS: PublicSellerProfile[] = [
  {
    id: 'user-1',
    firstName: 'Juan Andrés',
    lastName: 'Pérez Silva',
    bio: 'Especialista en fletes, traslados urbanos y reparaciones menores del hogar. Comprometido con la puntualidad y el buen trato.',
    isVerified: true,
    city: 'Providencia, RM',
    memberSince: '2023',
    score: 4.9,
    totalReviews: 28,
    responseTime: '< 15 min',
    completionRate: 98,
  },
  {
    id: 'user-2',
    firstName: 'Mariana',
    lastName: 'Gómez Torres',
    bio: 'Técnica en mantención del hogar. Especialidad en gasfitería, pintura y pequeñas reparaciones eléctricas.',
    isVerified: true,
    city: 'Ñuñoa, RM',
    memberSince: '2024',
    score: 4.7,
    totalReviews: 14,
    responseTime: '< 30 min',
    completionRate: 95,
  },
  {
    id: 'user-3',
    firstName: 'Carlos',
    lastName: 'Muñoz Rivas',
    bio: 'Vendedor de herramientas y artículos para el hogar. Entrega rápida en Santiago y alrededores.',
    isVerified: false,
    city: 'La Florida, RM',
    memberSince: '2024',
    score: 4.3,
    totalReviews: 7,
    responseTime: '< 1 hora',
    completionRate: 90,
  },
];

const DEFAULT_SELLER: PublicSellerProfile = MOCK_SELLERS[0];

/* -----------------------------------------------------------------------
 * Página pública del vendedor — /perfil/[id]
 * Muestra: Foto, Bio, Botón Contactar, Reputación y publicaciones reales
 * --------------------------------------------------------------------- */
export default function PublicProfilePage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const numericId = React.useMemo(() => {
    const digits = id.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : null;
  }, [id]);

  const [seller, setSeller] = React.useState<PublicSellerProfile>(() => {
    return (
      MOCK_SELLERS.find((s) => s.id === id || s.id === `user-${id}` || `user-${s.id}` === id) ??
      DEFAULT_SELLER
    );
  });

  const [sellerPublications, setSellerPublications] = React.useState<PublicProfilePublication[]>(
    [],
  );
  const [isLoadingPubs, setIsLoadingPubs] = React.useState(Boolean(numericId));

  // Cargar datos de perfil público del vendedor desde IAM
  React.useEffect(() => {
    if (!numericId) return;

    let isMounted = true;
    getPublicProfile(numericId).then((profile) => {
      if (!isMounted || !profile) return;
      setSeller((prev) => ({
        ...prev,
        id: String(profile.userId),
        firstName: profile.firstName,
        lastName: profile.lastName,
        bio: profile.bioExperiencia || prev.bio,
        city: profile.ciudad ? `${profile.ciudad}, ${profile.region || 'Chile'}` : prev.city,
        avatarUrl: profile.fotoPerfilUrl || prev.avatarUrl,
      }));
    });

    return () => {
      isMounted = false;
    };
  }, [numericId]);

  // Cargar publicaciones reales del vendedor desde el microservicio Catalog
  React.useEffect(() => {
    if (!numericId) return;

    let isMounted = true;

    publicationService
      .getPublications({ userId: numericId, limit: 50 })
      .then((res) => {
        if (!isMounted) return;
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
        console.error('Error al cargar publicaciones del vendedor:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPubs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [numericId]);

  const sellerReviews = React.useMemo(() => {
    const matched = MOCK_SELLER_REVIEWS.filter((r) => r.sellerId === seller.id);
    return matched.length > 0 ? matched : MOCK_SELLER_REVIEWS;
  }, [seller.id]);

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
          <span className="text-content-main font-semibold">
            {seller.firstName} {seller.lastName}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Columna izquierda — Header + Reputación */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">
            <PublicProfileHeader
              firstName={seller.firstName}
              lastName={seller.lastName}
              bio={seller.bio}
              isVerified={seller.isVerified}
              avatarUrl={seller.avatarUrl}
              city={seller.city}
              memberSince={seller.memberSince}
              onContact={() => {
                /* conectar con módulo de mensajería en sprint futuro */
              }}
            />
            <PublicProfileReputation
              score={seller.score}
              totalReviews={seller.totalReviews}
              responseTime={seller.responseTime}
              completionRate={seller.completionRate}
            />
          </div>

          {/* Columna derecha — Publicaciones reales de la base de datos y Reseñas */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            <PublicProfilePublications
              sellerName={seller.firstName}
              publications={sellerPublications}
              isLoading={isLoadingPubs}
            />
            <PublicProfileReviews
              sellerName={seller.firstName}
              averageScore={seller.score}
              reviews={sellerReviews}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
