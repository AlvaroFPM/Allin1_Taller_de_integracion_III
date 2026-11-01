'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { OrderCard } from './order-card';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { toDashboardOrder } from '@/lib/mappers/orders';
import type { OrderDto } from '@/types/dto/orders';
import type { DashboardOrder, OrderRole } from '@/types/orders-dashboard';

function subscribeToHydration(listener: () => void) {
  const start = useAuthStore.persist.onHydrate(() => listener());
  const finish = useAuthStore.persist.onFinishHydration(() => listener());
  return () => {
    start();
    finish();
  };
}

function mapList(orders: OrderDto[], role: OrderRole) {
  try {
    return {
      orders: orders.map((order) => toDashboardOrder(order, role)),
      error: null,
    };
  } catch {
    return {
      orders: [] as DashboardOrder[],
      error: 'La respuesta contiene datos de orden inválidos.',
    };
  }
}

export function OrdersDashboardPanel() {
  const userId = useAuthStore((state) => state.user?.id);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = React.useSyncExternalStore(
    subscribeToHydration,
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
  const purchases = useOrdersStore((state) => state.purchases);
  const sales = useOrdersStore((state) => state.sales);
  const loadPurchases = useOrdersStore((state) => state.loadPurchases);
  const loadSales = useOrdersStore((state) => state.loadSales);
  const [activeTab, setActiveTab] = React.useState<OrderRole>('COMPRA');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const sessionReady = hydrated && isAuthenticated && userId != null && Boolean(token);

  React.useEffect(() => {
    if (!sessionReady) return;
    const controller = new AbortController();
    void loadPurchases({}, controller.signal);
    void loadSales({}, controller.signal);
    return () => controller.abort();
  }, [sessionReady, userId, token, loadPurchases, loadSales]);

  const mappedPurchases = React.useMemo(
    () => mapList(purchases.orders, 'COMPRA'),
    [purchases.orders],
  );
  const mappedSales = React.useMemo(() => mapList(sales.orders, 'VENTA'), [sales.orders]);
  const orders = [...mappedPurchases.orders, ...mappedSales.orders];
  const totalCompras = mappedPurchases.orders.length;
  const totalVentas = mappedSales.orders.length;
  const stats = {
    comprasActivasCount: totalCompras,
    ventasActivasCount: totalVentas,
    completadasCount: orders.filter((order) => order.status === 'COMPLETADA').length,
  };
  const activeList = activeTab === 'COMPRA' ? purchases : sales;
  const activeMapped = activeTab === 'COMPRA' ? mappedPurchases : mappedSales;
  const activeError = activeList.error || activeMapped.error;
  const filteredOrders = activeMapped.orders.filter((order) => {
    if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    return (
      !query ||
      [order.title, order.orderNumber, order.counterpartName].some((value) =>
        value.toLowerCase().includes(query),
      )
    );
  });
  const loadPage = (page: number) => {
    if (!sessionReady || !Number.isInteger(page) || page < 1) return;
    void (activeTab === 'COMPRA' ? loadPurchases : loadSales)({ page });
  };
  const currentPage = activeList.meta?.currentPage;
  const totalPages = activeList.meta?.totalPages;

  if (!hydrated) return <p role="status">Comprobando sesión...</p>;
  if (!sessionReady) return <p role="status">Inicia sesión para consultar tus órdenes.</p>;
  return (
    <div className="space-y-8">
      {/* 1. Tarjetas de Resumen / Métricas del Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Compras cargadas
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.comprasActivasCount}
          </p>
          <span className="text-xs text-brand font-medium">Cantidad en la página cargada</span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Ventas cargadas
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.ventasActivasCount}
          </p>
          <span className="text-xs text-emerald-700 font-medium">
            Cantidad en la página cargada
          </span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Información de pagos
          </span>
          <p className="text-2xl font-black text-brand tracking-tight">No disponible</p>
          <span className="text-xs text-content-muted font-medium">
            No informada por la API de órdenes
          </span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Órdenes Completadas
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.completadasCount}
          </p>
          <span className="text-xs text-emerald-700 font-medium">
            Solo órdenes de las páginas cargadas
          </span>
        </div>
      </div>

      {/* 2. Pestañas Principales (Mis Compras vs Mis Ventas) */}
      <div className="bg-surface-main rounded-2xl border border-border-base p-2 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('COMPRA');
            setStatusFilter('ALL');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'COMPRA'
              ? 'bg-brand text-white shadow-xs'
              : 'text-content-muted hover:text-content-main hover:bg-surface-base'
          }`}
        >
          <span>Mis Compras</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'COMPRA'
                ? 'bg-white/20 text-white'
                : 'bg-surface-base text-content-muted'
            }`}
          >
            {totalCompras}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('VENTA');
            setStatusFilter('ALL');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'VENTA'
              ? 'bg-brand text-white shadow-xs'
              : 'text-content-muted hover:text-content-main hover:bg-surface-base'
          }`}
        >
          <span>Mis Ventas</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'VENTA'
                ? 'bg-white/20 text-white'
                : 'bg-surface-base text-content-muted'
            }`}
          >
            {totalVentas}
          </span>
        </button>
      </div>

      {/* 3. Barra de Búsqueda y Filtros de Estado */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filtros de Estado (Píldoras) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'ALL', label: 'Todas' },
            { key: 'PENDIENTE', label: 'Pendientes' },
            { key: 'ACEPTADA', label: 'Aceptadas' },
            { key: 'ESTADO_ORDEN_UNSPECIFIED', label: 'Sin estado informado' },
            { key: 'COMPLETADA', label: 'Completadas' },
            { key: 'CANCELADA', label: 'Canceladas' },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setStatusFilter(pill.key)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
                statusFilter === pill.key
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                  : 'bg-surface-main text-content-muted hover:text-content-main border border-border-base'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Buscador de Órdenes */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID de orden, publicación o usuario..."
            className="w-full text-xs py-2 pl-8 pr-3 rounded-xl border border-border-base bg-surface-main text-content-main placeholder:text-content-muted focus:outline-hidden focus:ring-2 focus:ring-brand"
          />
          <svg
            className="w-3.5 h-3.5 text-content-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <p className="text-xs text-content-muted">
        La API no informa nombres, tipos, moneda ni pagos. Las acciones no conectadas están
        deshabilitadas. Los contadores y filtros corresponden solo a las páginas cargadas. Compras:{' '}
        {purchases.status}. Ventas: {sales.status}.
      </p>

      {typeof currentPage === 'number' && typeof totalPages === 'number' && totalPages > 0 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={activeList.status === 'loading' || currentPage <= 1}
            onClick={() => loadPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={activeList.status === 'loading' || currentPage >= totalPages}
            onClick={() => loadPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* No convertir carga o error en éxito vacío. */}
      {activeList.status === 'loading' || activeList.status === 'idle' ? (
        <p role="status">Cargando órdenes...</p>
      ) : activeError ? (
        <div role="alert" className="space-y-3">
          <p>{activeError}</p>
          <Button type="button" size="sm" onClick={() => loadPage(1)}>
            Reintentar
          </Button>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="bg-surface-main rounded-3xl border border-border-base p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-surface-base text-content-muted mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-content-main">
              No se encontraron órdenes en esta sección
            </h3>
            <p className="text-xs text-content-muted">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Prueba cambiando los filtros o el término de búsqueda.'
                : activeTab === 'COMPRA'
                  ? 'Aún no has contratado servicios ni comprado artículos.'
                  : 'Aún no has recibido solicitudes ni realizado ventas.'}
            </p>
          </div>
          <div>
            {activeTab === 'COMPRA' ? (
              <Link href="/catalogo">
                <Button variant="primary" size="sm">
                  Explorar Catálogo de Servicios
                </Button>
              </Link>
            ) : (
              <Link href="/publicar">
                <Button variant="primary" size="sm">
                  + Publicar un Servicio o Artículo
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
