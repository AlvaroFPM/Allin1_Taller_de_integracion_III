'use client';

import * as React from 'react';
import { CatalogSearchHeader, CatalogSidebarFilters, CatalogGrid } from '@/components/shared';
import { toast } from '@/components/ui';
import {
  INITIAL_CATALOG_FILTERS,
  filterCatalogPublications,
  type CatalogFilterState,
  type CatalogPublication,
  MOCK_CATALOG_PUBLICATIONS,
} from '@/types/catalog';

export default function ExplorarPage() {
  const [filters, setFilters] = React.useState<CatalogFilterState>(INITIAL_CATALOG_FILTERS);
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Simulación de carga inicial al montar para mostrar skeletons
  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: 'all' | 'TRABAJO' | 'SERVICIO' | 'ARTICULO') => {
    setIsLoading(true);
    setFilters((prev) => ({ ...prev, activeTab: tab }));
    setTimeout(() => setIsLoading(false), 700);
  };

  const handleSidebarFilterChange = (fields: Partial<CatalogFilterState>) => {
    setIsLoading(true);
    setFilters((prev) => ({ ...prev, ...fields }));
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleSortChange = (sort: 'recent' | 'price_asc' | 'price_desc') => {
    setIsLoading(true);
    setFilters((prev) => ({ ...prev, sortBy: sort }));
    setTimeout(() => setIsLoading(false), 400);
  };

  const handleResetFilters = (closeMobile = false) => {
    setIsLoading(true);
    setFilters(INITIAL_CATALOG_FILTERS);
    if (closeMobile) setShowMobileFilters(false);
    toast.info('Filtros restablecidos');
    setTimeout(() => setIsLoading(false), 500);
  };

  // Filtrado reactivo en memoria
  const filteredPublications = React.useMemo(
    () => filterCatalogPublications(MOCK_CATALOG_PUBLICATIONS, filters),
    [filters],
  );

  // Conteos dinámicos
  const counts = React.useMemo(
    () => ({
      all: MOCK_CATALOG_PUBLICATIONS.length,
      trabajo: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'TRABAJO').length,
      servicio: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'SERVICIO').length,
      articulo: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'ARTICULO').length,
    }),
    [],
  );

  const categoryCounts = React.useMemo(
    () => ({
      mantenimiento: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'mantenimiento')
        .length,
      transporte: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'transporte').length,
      logistica: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'logistica').length,
      articulos: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'articulos').length,
    }),
    [],
  );

  const handlePublicationAction = (pub: CatalogPublication) => {
    if (pub.type === 'TRABAJO') {
      toast.success(`Has postulado al trabajo: "${pub.title}"`, { title: 'Postulación enviada' });
    } else {
      toast.info(`Redirigiendo a checkout para: "${pub.title}"`, { title: 'Comprar Artículo' });
    }
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
