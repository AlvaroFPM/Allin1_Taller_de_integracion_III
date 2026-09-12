import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RecentPublication } from "@/types/home";

const defaultPublications: RecentPublication[] = [
  {
    id: "1",
    badgeLabel: "Servicio Solicitado",
    badgeVariant: "serv",
    title: "Reparación urgente de calefont e inspección de gas",
    location: "📍 Providencia, RM",
    price: "$40.000 CLP",
    href: "/publicaciones/1",
  },
  {
    id: "2",
    badgeLabel: "Flete / Traslado",
    badgeVariant: "trans",
    title: "Flete express: Sillón 3 cuerpos + lavadora",
    location: "📍 Ñuñoa a Santiago",
    price: "$30.000 CLP",
    href: "/publicaciones/2",
  },
  {
    id: "3",
    badgeLabel: "Artículo en Venta",
    badgeVariant: "item",
    title: "Kit Taladro Percutor Inalámbrico 20V + Baterías",
    location: "📍 Las Condes, RM",
    price: "$45.000 CLP",
    href: "/publicaciones/3",
  },
];

export function HomeRecentActivity({ publications = defaultPublications }: { publications?: RecentPublication[] }) {
  return (
    <section className="space-y-6">
      {/* Cabecera con indicador en vivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-content-main">
            Últimas publicaciones
          </h2>
          <p className="text-xs sm:text-sm text-content-muted mt-0.5">
            Solicitudes y ofertas agregadas recientemente por la comunidad
          </p>
        </div>

        {/* Indicador de pulso en vivo */}
        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-brand-light text-brand-hover border border-brand/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
          </span>
          <span>Actualizaciones en vivo</span>
        </div>
      </div>

      {/* Cuadrícula de 3 publicaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {publications.map((pub) => {
          const badgeColor =
            pub.badgeVariant === "serv"
              ? "brand"
              : pub.badgeVariant === "trans"
              ? "warning"
              : "neutral";

          return (
            <Link
              key={pub.id}
              href={pub.href}
              className="group flex flex-col justify-between p-5 rounded-2xl bg-surface-main border border-border-base transition-all duration-200 hover:border-brand/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="space-y-3">
                <Badge variant={badgeColor} size="sm">
                  {pub.badgeLabel}
                </Badge>
                <h3 className="text-sm sm:text-base font-bold text-content-main line-clamp-2 leading-snug group-hover:text-brand transition-colors">
                  {pub.title}
                </h3>
              </div>

              <div className="pt-4 mt-4 border-t border-border-base/70 flex items-center justify-between text-xs">
                <span className="text-content-muted font-medium">{pub.location}</span>
                <span className="text-sm font-extrabold text-brand tracking-tight">
                  {pub.price}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
