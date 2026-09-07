import * as React from "react";
import type { CustomerReview } from "@/types/home";

const defaultReviews: CustomerReview[] = [
  {
    id: "1",
    reviewerName: "Camila R.",
    reviewerInitials: "CR",
    serviceTag: "Gasfitería & Plomería",
    rating: 5,
    comment:
      "Llegó en menos de 40 minutos para reparar una fuga en la cocina. El proceso de coordinación fue claro y sin complicaciones.",
    completedDate: "Completado hace 2 horas",
  },
  {
    id: "2",
    reviewerName: "Matías V.",
    reviewerInitials: "MV",
    serviceTag: "Fletes & Mudanzas",
    rating: 5,
    comment:
      "Excelente disposición para mover el sillón y las cajas hasta el departamento. Todo llegó en perfecto estado.",
    completedDate: "Completado hoy",
  },
  {
    id: "3",
    reviewerName: "Fernanda S.",
    reviewerInitials: "FS",
    serviceTag: "Compra de Herramientas",
    rating: 5,
    comment:
      "El artículo venía sellado y con entrega coordinada el mismo día. Muy práctico tener todo integrado en una sola plataforma.",
    completedDate: "Completado ayer",
  },
];

export function HomeReviews({ reviews = defaultReviews }: { reviews?: CustomerReview[] }) {
  return (
    <section className="space-y-6">
      {/* Cabecera */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-content-main">
          Lo que dicen nuestros usuarios
        </h2>
        <p className="text-xs sm:text-sm text-content-muted mt-0.5">
          Opiniones y calificaciones reales tras completar solicitudes
        </p>
      </div>

      {/* Cuadrícula de 3 reseñas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reviews.map((rev) => (
          <article
            key={rev.id}
            className="flex flex-col justify-between p-6 rounded-2xl bg-surface-main border border-border-base transition-all duration-200 hover:border-brand/40 hover:shadow-lg hover:-translate-y-0.5 gap-4"
          >
            {/* Cabecera de la reseña: Avatar, Nombre y Estrellas */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {rev.reviewerInitials}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-content-main leading-tight">
                    {rev.reviewerName}
                  </h4>
                  <span className="text-[11px] text-content-muted">
                    {rev.serviceTag}
                  </span>
                </div>
              </div>

              {/* Estrellas doradas */}
              <div className="text-amber-500 text-sm tracking-wider flex shrink-0 select-none">
                {"★".repeat(rev.rating)}
              </div>
            </div>

            {/* Testimonio */}
            <p className="text-xs sm:text-sm text-content-muted italic leading-relaxed">
              &ldquo;{rev.comment}&rdquo;
            </p>

            {/* Fecha completada */}
            <div className="pt-3 border-t border-border-base/70 text-[11px] font-medium text-content-muted">
              {rev.completedDate}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
