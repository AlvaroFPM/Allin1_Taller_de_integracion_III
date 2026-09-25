import {
  HomeCategories,
  HomeHero,
  HomeHowItWorks,
  HomeRecentActivity,
  HomeReviews,
} from '@/components/shared';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-20">
      {/* 1. Nube / Lluvia de categorías flotantes */}
      <HomeCategories />

      {/* 2. Sección central: Eslogan y Propósito */}
      <HomeHero />

      {/* 3. ¿Cómo funciona Allin1 en 3 pasos? */}
      <HomeHowItWorks />

      {/* 4. Actividad reciente en tiempo real */}
      <HomeRecentActivity />

      {/* 5. Reseñas y testimonios de la comunidad */}
      <HomeReviews />
    </div>
  );
}
