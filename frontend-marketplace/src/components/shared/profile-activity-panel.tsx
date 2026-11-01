'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/useAuthStore';
import { publicationService } from '@/services/publicationService';
import type { ProfileActivityFilter, ProfileActivityItem } from '@/types/profile';

export interface ProfileActivityPanelProps {
  userId?: number;
}

export function ProfileActivityPanel({ userId }: ProfileActivityPanelProps) {
  const storeUser = useAuthStore((state) => state.user);
  const targetUserId = userId !== undefined ? userId : storeUser?.id;

  const [activeFilter, setActiveFilter] = React.useState<ProfileActivityFilter>('ALL');
  const [items, setItems] = React.useState<ProfileActivityItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(Boolean(targetUserId));

  React.useEffect(() => {
    if (!targetUserId) return;

    let isMounted = true;

    publicationService
      .getPublications({ userId: targetUserId, limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.publications) {
          const mapped: ProfileActivityItem[] = res.publications.map((pub) => {
            const isDemand = pub.type === 'DEMANDA';
            const catSlug = (pub.categorySlug || '').toLowerCase();
            const isArticle =
              catSlug.includes('ropa') ||
              catSlug.includes('tec') ||
              catSlug.includes('mueble') ||
              catSlug.includes('mascota') ||
              catSlug.includes('articulo');

            let itemType: 'SOLICITUD' | 'TRABAJO' | 'ARTICULO' = 'TRABAJO';
            let typeLabel = 'SERVICIO OFRECIDO';
            let priceLabel = 'PRECIO DEL SERVICIO';
            let statusBadge = 'Publicación Activa';

            if (isDemand) {
              itemType = 'SOLICITUD';
              typeLabel = 'SOLICITUD CREADA';
              priceLabel = 'PRESUPUESTO ESCROW';
              statusBadge = 'Buscando Proveedor';
            } else if (isArticle) {
              itemType = 'ARTICULO';
              typeLabel = 'ARTÍCULO EN VENTA';
              priceLabel = 'PRECIO DE VENTA';
              statusBadge = 'En Venta';
            }

            return {
              id: String(pub.id),
              type: itemType,
              typeLabel,
              category: pub.categoryName || 'General',
              title: pub.title,
              statusBadge,
              location: pub.location || 'Chile',
              dateRelative: pub.createdAtRelative || 'Reciente',
              priceLabel,
              price: pub.price,
            };
          });

          setItems(mapped);
        }
      })
      .catch((error) => {
        console.error('Error al cargar publicaciones del perfil:', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUserId]);

  const counts = React.useMemo(() => {
    return {
      all: items.length,
      solicitud: items.filter((item) => item.type === 'SOLICITUD').length,
      trabajo: items.filter((item) => item.type === 'TRABAJO').length,
      articulo: items.filter((item) => item.type === 'ARTICULO').length,
    };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) => item.type === activeFilter);
  }, [items, activeFilter]);

  return (
    <div className="space-y-6">
      {/* Cabecera del Panel */}
      <div className="bg-surface-main rounded-2xl border border-border-base p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-main tracking-tight">
            Panel de Actividad y Publicaciones
          </h2>
          <p className="text-xs text-content-muted mt-1">
            Historial de publicaciones y servicios registrados en tu cuenta
          </p>
        </div>

        <Link href="/publicar" className="shrink-0">
          <Button variant="primary" size="sm">
            + Publicar Solicitud / Venta
          </Button>
        </Link>
      </div>

      {/* Pestañas de Filtro Dinámicas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(
          [
            { key: 'ALL', label: `Todo el Historial (${counts.all})` },
            { key: 'SOLICITUD', label: `Solicitudes Creadas (${counts.solicitud})` },
            { key: 'TRABAJO', label: `Servicios Ofrecidos (${counts.trabajo})` },
            { key: 'ARTICULO', label: `Artículos en Venta (${counts.articulo})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3.5 py-2 rounded-xl font-semibold transition-colors cursor-pointer shrink-0 ${
              activeFilter === tab.key
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-surface-main text-content-muted hover:text-content-main border border-border-base'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Estado de Carga */}
      {isLoading ? (
        <div className="bg-surface-main rounded-2xl border border-border-base p-12 text-center flex flex-col items-center justify-center gap-3">
          <Spinner size="md" variant="brand" />
          <p className="text-xs font-medium text-content-muted">
            Cargando tus publicaciones reales desde la base de datos...
          </p>
        </div>
      ) : items.length === 0 ? (
        /* Estado vacío: Sin publicaciones creadas */
        <div className="bg-surface-main rounded-2xl border border-border-base p-10 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl">
            📦
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-content-main">
              Aún no tienes publicaciones registradas
            </h3>
            <p className="text-xs text-content-muted max-w-sm mx-auto">
              Crea tu primera oferta o solicitud para que aparezca en el marketplace y otros
              usuarios puedan contactarte.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/publicar">
              <Button variant="primary" size="sm">
                + Crear mi primera publicación
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Estado vacío para el filtro activo */
        <div className="bg-surface-main rounded-2xl border border-border-base p-8 text-center text-xs text-content-muted">
          No tienes publicaciones en esta categoría seleccionada.
        </div>
      ) : (
        /* Listado de Tarjetas Reales */
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-surface-main rounded-2xl border border-border-base p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-600/30 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {item.typeLabel}
                  </span>
                  <span className="text-content-muted">• {item.category}</span>
                </div>

                <h3 className="text-base font-bold text-content-main">{item.title}</h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
                  <Badge variant="brand" size="sm">
                    {item.statusBadge}
                  </Badge>
                  <span>📍 {item.location}</span>
                  <span>🕒 {item.dateRelative}</span>
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border-base shrink-0">
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                    {item.priceLabel}
                  </span>
                  <span className="text-xl font-black text-emerald-700">
                    ${item.price.toLocaleString('es-CL')} CLP
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/catalogo/${item.id}`}>
                    <Button variant="secondary" size="sm">
                      Ver Detalles
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
