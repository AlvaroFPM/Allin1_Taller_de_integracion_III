import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CategoryPill } from "@/types/home";

const defaultCategories: CategoryPill[] = [
  { id: "fletes", label: "Flete & Mudanza", icon: "🚚", href: "/publicaciones?cat=fletes", size: "lg", highlight: true, offset: "top" },
  { id: "comida", label: "Pedir Comida", icon: "🍔", href: "/publicaciones?cat=comida", size: "md" },
  { id: "gasfiteria", label: "Gasfitería Urgente", icon: "🔧", href: "/publicaciones?cat=gasfiteria", size: "lg", offset: "bottom" },
  { id: "transporte", label: "Viaje / Auto", icon: "🚗", href: "/publicaciones?cat=transporte", size: "sm" },
  { id: "electricidad", label: "Electricista SEC", icon: "⚡", href: "/publicaciones?cat=electricidad", size: "md", offset: "top" },
  { id: "legal", label: "Abogado / Trámites", icon: "⚖️", href: "/publicaciones?cat=legal", size: "lg", highlight: true },
  { id: "delivery", label: "Reparto Express", icon: "🛵", href: "/publicaciones?cat=delivery", size: "sm", offset: "bottom" },
  { id: "limpieza", label: "Aseo Hogar", icon: "🧹", href: "/publicaciones?cat=limpieza", size: "md" },
  { id: "articulos", label: "Comprar / Vender Artículos", icon: "🛍️", href: "/publicaciones?cat=articulos", size: "lg", offset: "top" },
  { id: "mascotas", label: "Paseo de Perros", icon: "🐕", href: "/publicaciones?cat=mascotas", size: "sm" },
  { id: "pintura", label: "Pintor de Casas", icon: "🎨", href: "/publicaciones?cat=pintura", size: "md", offset: "bottom" },
  { id: "computacion", label: "Soporte Técnico PC", icon: "💻", href: "/publicaciones?cat=computacion", size: "sm", highlight: true },
  { id: "clases", label: "Clases Particulares", icon: "📚", href: "/publicaciones?cat=clases", size: "md" },
];

export function HomeCategories({ categories = defaultCategories }: { categories?: CategoryPill[] }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border-base bg-surface-main p-6 sm:p-10 lg:p-12 shadow-sm">
      {/* Barra de degradado superior verde menta/esmeralda */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-brand-dark via-brand to-[#10B981]" />

      <div className="mx-auto max-w-2xl text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-content-main">
          ¿Qué necesitas hoy?
        </h2>
        <p className="mt-2 text-sm sm:text-base text-content-muted">
          Encuentra personas, servicios y artículos en un ecosistema abierto y directo
        </p>
      </div>

      {/* Lluvia orgánica de categorías flotantes */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 py-2">
        {categories.map((cat) => {
          const sizeClasses =
            cat.size === "lg"
              ? "px-5 py-2.5 text-sm font-bold border-1.5"
              : cat.size === "sm"
              ? "px-3 py-1.5 text-xs font-semibold border-dashed text-content-muted"
              : "px-4 py-2 text-xs sm:text-sm font-semibold border";

          const offsetClass =
            cat.offset === "top"
              ? "md:-translate-y-1.5"
              : cat.offset === "bottom"
              ? "md:translate-y-1.5"
              : "";

          return (
            <Link
              key={cat.id}
              href={cat.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full transition-all duration-200 cursor-pointer select-none",
                "hover:-translate-y-1 hover:scale-105 hover:border-brand hover:shadow-md",
                cat.highlight
                  ? "bg-brand-light border-brand/30 text-brand-hover hover:bg-surface-main"
                  : "bg-surface-main border-border-base text-content-main hover:text-brand",
                sizeClasses,
                offsetClass
              )}
            >
              <span className="text-base sm:text-lg shrink-0 leading-none">{cat.icon}</span>
              <span>{cat.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
