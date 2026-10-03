import type { ComponentProps } from 'react';
import {
  HomeHero,
  HomeCategories,
  HomeHowItWorks,
  HomeRecentActivity,
  HomeReviews,
} from '@/components/shared';

export const dynamic = 'force-dynamic';

// Extraemos el tipo exacto de las publicaciones que acepta HomeRecentActivity
type HomeRecentActivityProps = ComponentProps<typeof HomeRecentActivity>;
type RecentPublicationItem = NonNullable<HomeRecentActivityProps['publications']>[number];

interface CatalogPublication {
  idPublicacion: number | string;
  tipoServicio: string;
  titulo: string;
  ciudad?: string;
  region?: string;
  precioBase?: number;
}

export default async function HomePage() {
  let recentPublications: RecentPublicationItem[] = [];

  try {
    const CATALOG_BASE =
      process.env.CATALOG_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_CATALOG_API_URL ??
      'http://localhost:8082';

    const res = await fetch(`${CATALOG_BASE}/v1/publications?limit=3`, {
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.publications)) {
        recentPublications = data.publications.map(
          (p: CatalogPublication): RecentPublicationItem => {
            const isOferta = p.tipoServicio === 'OFERTA';
            const isArticulo = p.tipoServicio === 'ARTICULO';
            return {
              id: p.idPublicacion.toString(),
              badgeLabel: isArticulo ? 'Artículo en Venta' : (isOferta ? 'Ofrece Servicio' : 'Busca Servicio'),
              // Hacemos cast seguro al tipo de badgeVariant que espera la interfaz original
              badgeVariant: (isArticulo ? 'item' : (isOferta ? 'serv' : 'req')) as RecentPublicationItem['badgeVariant'],
              title: p.titulo,
              location: `📍 ${p.ciudad || 'Santiago'}, ${p.region || 'RM'}`,
              price: `$${(p.precioBase || 0).toLocaleString('es-CL')} CLP`,
              href: `/publicaciones/${p.idPublicacion}`,
            };
          },
        );
      }
    }
  } catch (err: unknown) {
    console.error('Error fetching publications:', err);
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-20">
      {/* 1. Nube / Lluvia de categorías flotantes */}
      <HomeCategories />

      {/* 2. Sección central: Eslogan y Propósito */}
      <HomeHero />

      {/* 3. ¿Cómo funciona Allin1 en 3 pasos? */}
      <HomeHowItWorks />

      {/* 4. Actividad reciente en tiempo real */}
      <HomeRecentActivity
        publications={recentPublications.length > 0 ? recentPublications : undefined}
        isLoading={false}
      />

      {/* 5. Reseñas y testimonios de la comunidad */}
      <HomeReviews />
    </div>
  );
}
