'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CatalogSearchHeader, CatalogSidebarFilters, CatalogGrid } from '@/components/shared';
import { toast } from '@/components/ui';
import {
  INITIAL_CATALOG_FILTERS,
  filterCatalogPublications,
  type CatalogFilterState,
  type CatalogPublication,
} from '@/types/catalog';
import {
  publicationService,
  type CatalogPublication as ServicePub,
} from '@/services/publicationService';
import { useAuthStore } from '@/store/useAuthStore';

function mapToCatalogSlug(
  slug?: string,
): 'mantenimiento' | 'transporte' | 'logistica' | 'articulos' {
  if (!slug) return 'mantenimiento';
  const s = slug.toLowerCase();
  if (s.includes('transporte') || s.includes('flete')) return 'transporte';
  if (s.includes('delivery') || s.includes('logistica')) return 'logistica';
  if (
    s.includes('ropa') ||
    s.includes('tec') ||
    s.includes('mueble') ||
    s.includes('mascota') ||
    s.includes('articulo')
  ) {
    return 'articulos';
  }
  return 'mantenimiento';
}

export default function ExplorarPage() {
  const router = useRouter();
  const storeUser = useAuthStore((state) => state.user);
  const currentUserId = storeUser?.id;

  const [filters, setFilters] = React.useState<CatalogFilterState>(INITIAL_CATALOG_FILTERS);
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dbPublications, setDbPublications] = React.useState<CatalogPublication[]>([]);

  React.useEffect(() => {
    let isMounted = true;

    const fetchDbPublications = async () => {
      try {
        setIsLoading(true);
        // RN-12: Excluir las publicaciones del usuario en sesión en la vista de explorar
        const data = await publicationService.getPublications({
          limit: 100,
          excludeUserId: currentUserId,
        });
        if (!isMounted) return;
        if (data && data.publications) {
          const mapped: CatalogPublication[] = data.publications.map((item: ServicePub) => {
            const isDemand = item.type === 'DEMANDA';
            const catSlug = mapToCatalogSlug(item.categorySlug);
            const pubType: 'TRABAJO' | 'SERVICIO' | 'ARTICULO' = isDemand
              ? 'TRABAJO'
              : catSlug === 'articulos'
                ? 'ARTICULO'
                : 'SERVICIO';

            return {
              id: String(item.id),
              type: pubType,
              title: item.title,
              description: item.description,
              price: item.price,
              currency: 'CLP',
              priceTypeLabel: isDemand ? 'PRESUPUESTO ESCROW' : 'PRECIO UNITARIO',
              actionButtonText: isDemand ? 'Aceptar Trabajo' : 'Comprar Artículo',
              createdAtRelative: item.createdAtRelative || 'Reciente',
              categorySlug: catSlug,
              categoryName: item.categoryName || 'General',
              location: item.location || 'Chile',
              details: {
                label1: 'Categoría',
                value1: item.categoryName || 'General',
                label2: 'Ubicación',
                value2: item.location || 'Chile',
              },
              escrowProtected: true,
              verifiedUser: true,
            };
          });
          setDbPublications(mapped);
        }
      } catch (error) {
        console.error('Error al cargar publicaciones de la base de datos:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDbPublications();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const handleTabChange = (tab: 'all' | 'TRABAJO' | 'SERVICIO' | 'ARTICULO') => {
    setFilters((prev) => ({ ...prev, activeTab: tab }));
  };

  const handleSidebarFilterChange = (fields: Partial<CatalogFilterState>) => {
    setFilters((prev) => ({ ...prev, ...fields }));
  };

  const handleSortChange = (sort: 'recent' | 'price_asc' | 'price_desc') => {
    setFilters((prev) => ({ ...prev, sortBy: sort }));
  };

  const handleResetFilters = (closeMobile = false) => {
    setFilters(INITIAL_CATALOG_FILTERS);
    if (closeMobile) setShowMobileFilters(false);
    toast.info('Filtros restablecidos');
  };

  // Filtrado reactivo sobre las publicaciones reales de la base de datos
  const filteredPublications = React.useMemo(
    () => filterCatalogPublications(dbPublications, filters),
    [dbPublications, filters],
  );

  // Conteos dinámicos en base a los datos reales
  const counts = React.useMemo(
    () => ({
      all: dbPublications.length,
      trabajo: dbPublications.filter((p) => p.type === 'TRABAJO').length,
      servicio: dbPublications.filter((p) => p.type === 'SERVICIO').length,
      articulo: dbPublications.filter((p) => p.type === 'ARTICULO').length,
    }),
    [dbPublications],
  );

  const categoryCounts = React.useMemo(
    () => ({
      mantenimiento: dbPublications.filter((p) => p.categorySlug === 'mantenimiento').length,
      transporte: dbPublications.filter((p) => p.categorySlug === 'transporte').length,
      logistica: dbPublications.filter((p) => p.categorySlug === 'logistica').length,
      articulos: dbPublications.filter((p) => p.categorySlug === 'articulos').length,
    }),
    [dbPublications],
  );

  const handlePublicationAction = (pub: CatalogPublication) => {
    router.push(`/catalogo/${pub.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <CatalogSearchHeader
        search={filters.search}
        onSearchChange={(val) => setFilters((prev) => ({ ...prev, search: val }))}
        comuna={filters.comuna}
        onComunaChange={(val) => setFilters((prev) => ({ ...prev, comuna: val }))}
        onSearchSubmit={() => {
          setIsLoading(true);
          setTimeout(() => setIsLoading(false), 500);
        }}
        activeTab={filters.activeTab}
        onTabChange={handleTabChange}
        counts={counts}
        onToggleMobileFilters={() => setShowMobileFilters((prev) => !prev)}
      />

      <div className="flex flex-col md:flex-row items-start gap-6 lg:gap-8">
        <div className="hidden md:block w-64 lg:w-72 shrink-0 sticky top-24">
          <CatalogSidebarFilters
            filters={filters}
            onChange={handleSidebarFilterChange}
            onApply={() => toast.info('Filtros actualizados')}
            onReset={() => handleResetFilters(false)}
            categoryCounts={categoryCounts}
          />
        </div>

        {showMobileFilters && (
          <div className="md:hidden w-full bg-surface-base border border-border-base rounded-2xl p-4">
            <CatalogSidebarFilters
              filters={filters}
              onChange={handleSidebarFilterChange}
              onApply={() => {
                setShowMobileFilters(false);
                toast.info('Filtros aplicados');
              }}
              onReset={() => handleResetFilters(true)}
              categoryCounts={categoryCounts}
            />
          </div>
        )}

        <CatalogGrid
          publications={filteredPublications}
          totalCount={filteredPublications.length}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
          onAction={handlePublicationAction}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
