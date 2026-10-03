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
            return {
              id: p.idPublicacion.toString(),
              badgeLabel: isOferta ? 'Ofrece Servicio' : 'Busca Servicio',
              // Hacemos cast seguro al tipo de badgeVariant que espera la interfaz original
              badgeVariant: (isOferta ? 'serv' : 'req') as RecentPublicationItem['badgeVariant'],
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
      <HomeHero />
      <HomeCategories />
      <HomeHowItWorks />
      <HomeRecentActivity publications={recentPublications} isLoading={isLoading} />
      <HomeReviews />
    </main>
  );
}
