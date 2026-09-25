'use client';

import * as React from 'react';
import { CatalogSearchHeader, CatalogSidebarFilters, CatalogGrid } from '@/components/shared';
import { toast } from '@/components/ui';
import {
  type CatalogFilterState,
  type CatalogPublication,
  MOCK_CATALOG_PUBLICATIONS,
} from '@/types/catalog';

export default function ExplorarPage() {
  const [filters, setFilters] = React.useState<CatalogFilterState>({
    search: '',
    comuna: '',
    activeTab: 'all',
    categories: ['mantenimiento', 'transporte', 'logistica', 'articulos'],
    minPrice: '',
    maxPrice: '',
    escrowOnly: false,
    verifiedOnly: false,
    sortBy: 'recent',
  });

  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Filtrado reactivo en memoria
  const filteredPublications = React.useMemo(() => {
    return MOCK_CATALOG_PUBLICATIONS.filter((pub) => {
      // 1. Tipo / Tab
      if (filters.activeTab !== 'all' && pub.type !== filters.activeTab) {
        return false;
      }
      // 2. Búsqueda por texto (título, descripción, ubicación)
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const matches =
          pub.title.toLowerCase().includes(query) ||
          pub.description.toLowerCase().includes(query) ||
          pub.location.toLowerCase().includes(query);
        if (!matches) return false;
      }
      // 3. Comuna
      if (filters.comuna && !pub.location.toLowerCase().includes(filters.comuna.toLowerCase())) {
        return false;
      }
      // 4. Categoría
      if (filters.categories.length > 0 && !filters.categories.includes(pub.categorySlug)) {
        return false;
      }
      // 5. Rango de precio
      if (filters.minPrice !== '' && pub.price < Number(filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice !== '' && pub.price > Number(filters.maxPrice)) {
        return false;
      }
      // 6. Escrow & Verificado
      if (filters.escrowOnly && !pub.escrowProtected) return false;
      if (filters.verifiedOnly && !pub.verifiedUser) return false;

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'price_asc') return a.price - b.price;
      if (filters.sortBy === 'price_desc') return b.price - a.price;
      return 0; // 'recent' preserva orden mock
    });
  }, [filters]);

  // Conteos dinámicos para tabs y checkboxes
  const counts = React.useMemo(() => {
    return {
      all: MOCK_CATALOG_PUBLICATIONS.length,
      trabajo: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'TRABAJO').length,
      servicio: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'SERVICIO').length,
      articulo: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.type === 'ARTICULO').length,
    };
  }, []);

  const categoryCounts = React.useMemo(() => {
    return {
      mantenimiento: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'mantenimiento')
        .length,
      transporte: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'transporte').length,
      logistica: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'logistica').length,
      articulos: MOCK_CATALOG_PUBLICATIONS.filter((p) => p.categorySlug === 'articulos').length,
    };
  }, []);

  const handlePublicationAction = (pub: CatalogPublication) => {
    if (pub.type === 'TRABAJO') {
      toast.success(`Has postulado al trabajo: "${pub.title}"`, {
        title: 'Postulación enviada',
      });
    } else {
      toast.info(`Redirigiendo a checkout para: "${pub.title}"`, {
        title: 'Comprar Artículo',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* 1. Encabezado de Búsqueda y Pestañas Superiores */}
      <CatalogSearchHeader
        search={filters.search}
        onSearchChange={(val) => setFilters((prev) => ({ ...prev, search: val }))}
        comuna={filters.comuna}
        onComunaChange={(val) => setFilters((prev) => ({ ...prev, comuna: val }))}
        onSearchSubmit={() => {}}
        activeTab={filters.activeTab}
        onTabChange={(tab) => setFilters((prev) => ({ ...prev, activeTab: tab }))}
        counts={counts}
        onToggleMobileFilters={() => setShowMobileFilters((prev) => !prev)}
      />

      {/* 2. Cuerpo: Barra Lateral de Filtros + Grilla de Publicaciones */}
      <div className="flex flex-col md:flex-row items-start gap-6 lg:gap-8">
        {/* Sidebar Desktop */}
        <div className="hidden md:block w-64 lg:w-72 shrink-0 sticky top-24">
          <CatalogSidebarFilters
            filters={filters}
            onChange={(fields) => setFilters((prev) => ({ ...prev, ...fields }))}
            onApply={() => toast.info('Filtros actualizados')}
            onReset={() => {
              setFilters({
                search: '',
                comuna: '',
                activeTab: 'all',
                categories: ['mantenimiento', 'transporte', 'logistica', 'articulos'],
                minPrice: '',
                maxPrice: '',
                escrowOnly: false,
                verifiedOnly: false,
                sortBy: 'recent',
              });
              toast.info('Filtros restablecidos');
            }}
            categoryCounts={categoryCounts}
          />
        </div>

        {/* Sidebar Mobile Desplegable */}
        {showMobileFilters && (
          <div className="md:hidden w-full bg-surface-base border border-border-base rounded-2xl p-4">
            <CatalogSidebarFilters
              filters={filters}
              onChange={(fields) => setFilters((prev) => ({ ...prev, ...fields }))}
              onApply={() => {
                setShowMobileFilters(false);
                toast.info('Filtros aplicados');
              }}
              onReset={() => {
                setFilters({
                  search: '',
                  comuna: '',
                  activeTab: 'all',
                  categories: ['mantenimiento', 'transporte', 'logistica', 'articulos'],
                  minPrice: '',
                  maxPrice: '',
                  escrowOnly: false,
                  verifiedOnly: false,
                  sortBy: 'recent',
                });
                setShowMobileFilters(false);
              }}
              categoryCounts={categoryCounts}
            />
          </div>
        )}

        {/* Grilla Principal */}
        <CatalogGrid
          publications={filteredPublications}
          totalCount={filteredPublications.length}
          sortBy={filters.sortBy}
          onSortChange={(sort) => setFilters((prev) => ({ ...prev, sortBy: sort }))}
          onAction={handlePublicationAction}
        />
      </div>
    </div>
  );
}
