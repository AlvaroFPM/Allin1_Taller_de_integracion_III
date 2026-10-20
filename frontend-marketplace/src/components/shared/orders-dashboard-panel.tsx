'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { OrderCard } from './order-card';
import {
  MOCK_ORDERS,
  type DashboardOrder,
  type OrderRole,
  type OrderStatus,
} from '@/types/orders-dashboard';

export interface OrdersDashboardPanelProps {
  initialOrders?: DashboardOrder[];
}

export function OrdersDashboardPanel({ initialOrders = MOCK_ORDERS }: OrdersDashboardPanelProps) {
  const [orders, setOrders] = React.useState<DashboardOrder[]>(initialOrders);
  const [activeTab, setActiveTab] = React.useState<OrderRole>('COMPRA');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  // Estadísticas globales del dashboard
  const stats = React.useMemo(() => {
    const comprasActivas = orders.filter(
      (o) => o.role === 'COMPRA' && (o.status === 'EN_PROCESO' || o.status === 'PAGO_CUSTODIADO'),
    );
    const ventasActivas = orders.filter(
      (o) => o.role === 'VENTA' && (o.status === 'EN_PROCESO' || o.status === 'PAGO_CUSTODIADO'),
    );
    const completadas = orders.filter((o) => o.status === 'COMPLETADA');
    const totalEnEscrow = orders
      .filter(
        (o) => o.escrowSecured && (o.status === 'EN_PROCESO' || o.status === 'PAGO_CUSTODIADO'),
      )
      .reduce((sum, o) => sum + o.price, 0);

    return {
      comprasActivasCount: comprasActivas.length,
      ventasActivasCount: ventasActivas.length,
      completadasCount: completadas.length,
      totalEnEscrow,
    };
  }, [orders]);

  // Filtrado reactivo por pestaña, estado y buscador
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      // 1. Filtro por pestaña (Compras / Ventas)
      if (order.role !== activeTab) return false;

      // 2. Filtro por estado
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;

      // 3. Filtro por buscador (título, código o contraparte)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = order.title.toLowerCase().includes(query);
        const matchNumber = order.orderNumber.toLowerCase().includes(query);
        const matchCounterpart = order.counterpartName.toLowerCase().includes(query);
        if (!matchTitle && !matchNumber && !matchCounterpart) return false;
      }

      return true;
    });
  }, [orders, activeTab, statusFilter, searchQuery]);

  // Contadores para las pestañas
  const totalCompras = orders.filter((o) => o.role === 'COMPRA').length;
  const totalVentas = orders.filter((o) => o.role === 'VENTA').length;

  // Acciones interactivas en vivo
  const handleConfirmReceipt = (order: DashboardOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'COMPLETADA' as OrderStatus } : o)),
    );
    toast.success(
      `¡Has confirmado la recepción de "${order.title}"! Los fondos han sido liberados al vendedor.`,
      { title: 'Pago Liberado con Éxito' },
    );
  };

  const handleMarkCompleted = (order: DashboardOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'COMPLETADA' as OrderStatus } : o)),
    );
    toast.success(
      `Has marcado como terminado el trabajo para ${order.counterpartName}. El cliente revisará la entrega para liberar los fondos.`,
      { title: 'Trabajo Terminado' },
    );
  };

  const handleContact = (order: DashboardOrder) => {
    toast.info(`Abriendo canal de mensajería seguro con ${order.counterpartName}...`, {
      title: 'Mensajería Escrow',
    });
  };

  const handleRate = (order: DashboardOrder) => {
    toast.info(`Abriendo modal de calificación para ${order.counterpartName}...`, {
      title: 'Calificar Servicio',
    });
  };

  const handleViewDetail = (order: DashboardOrder) => {
    toast.info(
      `Detalle de la orden ${order.orderNumber}: $${order.price.toLocaleString('es-CL')} CLP bajo custodia Escrow.`,
      { title: 'Información de Orden' },
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. Tarjetas de Resumen / Métricas del Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Compras en Curso
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.comprasActivasCount}
          </p>
          <span className="text-xs text-brand font-medium">Bajo custodia protegida</span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Ventas en Curso
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.ventasActivasCount}
          </p>
          <span className="text-xs text-emerald-700 font-medium">Por cobrar al terminar</span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Fondos Activos en Escrow
          </span>
          <p className="text-2xl font-black text-brand tracking-tight">
            ${stats.totalEnEscrow.toLocaleString('es-CL')}
          </p>
          <span className="text-xs text-content-muted font-medium">Garantía protegida</span>
        </div>

        <div className="bg-surface-main p-5 rounded-2xl border border-border-base shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Órdenes Completadas
          </span>
          <p className="text-2xl font-black text-content-main tracking-tight">
            {stats.completadasCount}
          </p>
          <span className="text-xs text-emerald-700 font-medium">100% de éxito</span>
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
            { key: 'PAGO_CUSTODIADO', label: 'En Custodia Escrow' },
            { key: 'EN_PROCESO', label: 'En Proceso' },
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
            placeholder="Buscar por orden, título o persona..."
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

      {/* 4. Lista de Tarjetas de Órdenes */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onConfirmReceipt={handleConfirmReceipt}
              onMarkCompleted={handleMarkCompleted}
              onContact={handleContact}
              onRate={handleRate}
              onViewDetail={handleViewDetail}
            />
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
