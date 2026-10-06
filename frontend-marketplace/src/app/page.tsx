'use client';

import * as React from 'react';
import {
  HomeHero,
  HomeCategories,
  HomeHowItWorks,
  HomeRecentActivity,
  HomeReviews,
} from '@/components/shared';
import { publicationService, type CatalogPublication } from '@/services/publicationService';
import type { RecentPublication, PublicationBadgeVariant } from '@/types/home';

export default function HomePage() {
  const [recentPublications, setRecentPublications] = React.useState<RecentPublication[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRecent = async () => {
      try {
        const data = await publicationService.getPublications({ limit: 6 });
        if (data && data.publications) {
          const mapped: RecentPublication[] = data.publications.map((item: CatalogPublication) => {
            const isOffer = item.type === 'OFERTA';

            // Asigna 'serv' para ofertas/servicios e 'item' para solicitudes/productos
            const badgeVariant: PublicationBadgeVariant = isOffer ? 'serv' : 'item';

            return {
              id: String(item.id),
              badgeLabel: isOffer ? 'Oferta' : 'Solicitud',
              badgeVariant,
              title: item.title,
              location: 'Santiago, Chile',
              price: `$${item.price.toLocaleString('es-CL')}`,
              href: `/catalogo/${item.id}`,
            };
          });
          setRecentPublications(mapped);
        }
      } catch (error) {
        console.error('Error fetching home publications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecent();
  }, []);

  return (
    <main className="min-h-screen bg-surface-base">
      <div className="container mx-auto px-4 py-8 space-y-16 lg:space-y-24">
        <HomeHero />
        <HomeCategories />
        <HomeHowItWorks />
        <HomeRecentActivity publications={recentPublications} isLoading={isLoading} />
        <HomeReviews />
      </div>
    </main>
  );
}
