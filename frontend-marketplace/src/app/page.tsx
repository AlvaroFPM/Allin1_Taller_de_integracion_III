import {
  HomeCategories,
  HomeHero,
  HomeHowItWorks,
  HomeRecentActivity,
  HomeReviews,
} from '@/components/shared';

export default async function HomePage() {
  let recentPublications = [];
  try {
    const res = await fetch('http://localhost:8082/v1/publications?limit=3', { cache: 'no-store' });
    const data = await res.json();
    if (data && data.publications) {
      recentPublications = data.publications.map((p: any) => ({
        id: p.idPublicacion.toString(),
        badgeLabel: p.tipoServicio === 'OFERTA' ? 'Ofrece Servicio' : 'Busca Servicio',
        badgeVariant: p.tipoServicio === 'OFERTA' ? 'serv' : 'serv',
        title: p.titulo,
        location: `📍 ${p.ciudad || 'Santiago'}, ${p.region || 'RM'}`,
        price: `$${p.precioBase || 0} CLP`,
        href: `/publicaciones/${p.idPublicacion}`,
      }));
    }
  } catch (err) {
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
      <HomeRecentActivity publications={recentPublications.length > 0 ? recentPublications : undefined} />

      {/* 5. Reseñas y testimonios de la comunidad */}
      <HomeReviews />
    </div>
  );
}
