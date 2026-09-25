import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function HomeHero() {
  return (
    <section className="mx-auto max-w-4xl text-center flex flex-col items-center gap-5 py-4">
      {/* Título de alto impacto con degradado */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-content-main leading-[1.15]">
        All in 1:{' '}
        <span className="bg-linear-to-r from-brand-dark via-brand to-[#10B981] bg-clip-text text-transparent">
          todo lo que necesitas
        </span>{' '}
        en un solo clic.
      </h1>

      {/* Bajada explicativa */}
      <p className="max-w-2xl text-base sm:text-lg text-content-muted leading-relaxed">
        La plataforma unificada donde puedes solicitar desde un flete express o un arreglo doméstico
        hasta comprar productos y contratar asistencia profesional de forma directa.
      </p>

      {/* Botones de acción principales */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2 w-full sm:w-auto">
        <Link href="/publicaciones" className="w-full sm:w-auto">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-linear-to-r from-brand to-[#10B981] hover:brightness-105 text-white shadow-md font-bold px-8"
          >
            Explorar Oportunidades
          </Button>
        </Link>
        <Link href="/registro" className="w-full sm:w-auto">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto font-bold px-8 hover:bg-surface-base"
          >
            Publicar un Servicio
          </Button>
        </Link>
      </div>
    </section>
  );
}
