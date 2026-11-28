'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OrderCard } from './order-card';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useOrderActionsStore } from '@/store/useOrderActionsStore';
import { toDashboardOrder } from '@/lib/mappers/orders';
import { publicationService, type CatalogPublication } from '@/services/publicationService';
import { getPublicProfile, type PublicProfileData } from '@/services/authService';
import { orderExtrasService, type OrderExtraDto } from '@/services/orderExtrasService';
import type { OrderDto } from '@/types/dto/orders';
import type { DashboardOrder, OrderRole } from '@/types/orders-dashboard';

type ConfirmActionKind = 'deliver' | 'complete' | 'cancel';

interface PendingConfirmation {
  kind: ConfirmActionKind;
  orderId: number;
  orderNumber: string;
  title: string;
}

interface PendingReview {
  orderId: number;
  orderNumber: string;
  title: string;
  sellerName: string;
}

function subscribeToHydration(listener: () => void) {
  const start = useAuthStore.persist.onHydrate(() => listener());
  const finish = useAuthStore.persist.onFinishHydration(() => listener());
  return () => {
    start();
    finish();
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0] ? parts[0].slice(0, 2).toUpperCase() : '?';
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

function enrichList(
  dtos: OrderDto[],
  role: OrderRole,
  publicationsById: Record<number, CatalogPublication>,
  profilesById: Record<number, PublicProfileData>,
  extrasByOrderId: Record<number, OrderExtraDto>,
) {
  const mapped = mapList(dtos, role);
  if (mapped.error) return mapped;

  return {
    error: null,
    orders: mapped.orders.map((order, index) => {
      const dto = dtos[index];
      const pub = dto?.idPublicacion ? publicationsById[dto.idPublicacion] : undefined;
      const counterpartId = role === 'COMPRA' ? dto?.idUsuarioVendedor : dto?.idUsuarioComprador;
      const profile = counterpartId ? profilesById[counterpartId] : undefined;
      const extra = dto?.idOrden ? extrasByOrderId[dto.idOrden] : undefined;
      const fullName = profile
        ? [profile.firstName, profile.lastName]
            .map((part) => part?.trim() ?? '')
            .filter(Boolean)
            .join(' ')
        : '';

      return {
        ...order,
        publicationId: dto?.idPublicacion,
        counterpartId,
        title: pub?.title?.trim() ? pub.title : order.title,
        currency: pub?.currency || 'CLP',
        counterpartName: fullName || order.counterpartName,
        counterpartInitials: fullName ? getInitials(fullName) : order.counterpartInitials,
        counterpartAvatarUrl: profile?.fotoPerfilUrl || order.counterpartAvatarUrl,
        notes: extra?.notas || undefined,
        scheduledDate: extra?.fechaAcordada || undefined,
        sellerDelivered: Boolean(extra?.vendedorConfirmoEntrega),
        sellerDeliveredAt: extra?.fechaEntregaVendedor,
        review: extra?.review
          ? {
              rating: extra.review.rating,
              comment: extra.review.comentario,
              createdAt: extra.review.createdAt,
            }
          : undefined,
      };
    }),
  };
}

export function OrdersDashboardPanel() {
  const router = useRouter();
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
  const actions = useOrderActionsStore((state) => state.actions);
  const changeStatus = useOrderActionsStore((state) => state.changeStatus);
  const [activeTab, setActiveTab] = React.useState<OrderRole>('COMPRA');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [publicationsById, setPublicationsById] = React.useState<
    Record<number, CatalogPublication>
  >({});
  const [profilesById, setProfilesById] = React.useState<Record<number, PublicProfileData>>({});
  const [extrasByOrderId, setExtrasByOrderId] = React.useState<Record<number, OrderExtraDto>>({});
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirmation | null>(null);
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [extraActionError, setExtraActionError] = React.useState<string | null>(null);
  const [pendingReview, setPendingReview] = React.useState<PendingReview | null>(null);
  const [reviewRating, setReviewRating] = React.useState(5);
  const [reviewComment, setReviewComment] = React.useState('');
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const requestedPublicationIds = React.useRef<Set<number>>(new Set());
  const requestedProfileIds = React.useRef<Set<number>>(new Set());
  const sessionReady = hydrated && isAuthenticated && userId != null && Boolean(token);

  React.useEffect(() => {
    if (!sessionReady) return;
    const controller = new AbortController();
    void loadPurchases({}, controller.signal);
    void loadSales({}, controller.signal);
    return () => controller.abort();
  }, [sessionReady, userId, token, loadPurchases, loadSales]);

  // Cargar publicaciones, perfiles públicos y extras (notas, fecha, entrega, reseñas)
  React.useEffect(() => {
    if (!sessionReady) return;
    const controller = new AbortController();
    const requestedPubs = requestedPublicationIds.current;
    const requestedProfiles = requestedProfileIds.current;

    const publicationIds = new Set<number>();
    const profileIds = new Set<number>();
    const allOrderIds: number[] = [];

    for (const order of purchases.orders) {
      if (order.idOrden && order.idOrden > 0) allOrderIds.push(order.idOrden);
      if (order.idPublicacion && order.idPublicacion > 0) {
        publicationIds.add(order.idPublicacion);
      }
      if (order.idUsuarioVendedor && order.idUsuarioVendedor > 0) {
        profileIds.add(order.idUsuarioVendedor);
      }
    }
    for (const order of sales.orders) {
      if (order.idOrden && order.idOrden > 0) allOrderIds.push(order.idOrden);
      if (order.idPublicacion && order.idPublicacion > 0) {
        publicationIds.add(order.idPublicacion);
      }
      if (order.idUsuarioComprador && order.idUsuarioComprador > 0) {
        profileIds.add(order.idUsuarioComprador);
      }
    }

    if (allOrderIds.length > 0) {
      void orderExtrasService
        .getExtras(allOrderIds, controller.signal)
        .then((raw) => {
          if (controller.signal.aborted) return;
          const updates: Record<number, OrderExtraDto> = {};
          for (const [key, value] of Object.entries(raw)) {
            const numericKey = Number(key);
            if (Number.isInteger(numericKey) && numericKey > 0) {
              updates[numericKey] = value;
            }
          }
          setExtrasByOrderId((prev) => ({ ...prev, ...updates }));
        })
        .catch(() => {
          // Degradación segura si extras no responde
        });
    }

    const missingPubs = Array.from(publicationIds).filter((id) => !requestedPubs.has(id));
    const missingProfiles = Array.from(profileIds).filter((id) => !requestedProfiles.has(id));

    const inFlightPubs = new Set(missingPubs);
    const inFlightProfiles = new Set(missingProfiles);

    if (missingPubs.length > 0) {
      missingPubs.forEach((id) => requestedPubs.add(id));
      void Promise.all(
        missingPubs.map(async (id) => {
          try {
            const pub = await publicationService.getPublicationById(String(id), controller.signal);
            inFlightPubs.delete(id);
            return [id, pub] as const;
          } catch {
            if (!controller.signal.aborted) {
              inFlightPubs.delete(id);
            }
            return null;
          }
        }),
      ).then((results) => {
        if (controller.signal.aborted) return;
        const updates: Record<number, CatalogPublication> = {};
        for (const entry of results) {
          if (entry) updates[entry[0]] = entry[1];
        }
        if (Object.keys(updates).length > 0) {
          setPublicationsById((prev) => ({ ...prev, ...updates }));
        }
      });
    }

    if (missingProfiles.length > 0) {
      missingProfiles.forEach((id) => requestedProfiles.add(id));
      void Promise.all(
        missingProfiles.map(async (id) => {
          const profile = await getPublicProfile(id, controller.signal);
          if (!controller.signal.aborted) {
            inFlightProfiles.delete(id);
          }
          return profile ? ([id, profile] as const) : null;
        }),
      ).then((results) => {
        if (controller.signal.aborted) return;
        const updates: Record<number, PublicProfileData> = {};
        for (const entry of results) {
          if (entry) updates[entry[0]] = entry[1];
        }
        if (Object.keys(updates).length > 0) {
          setProfilesById((prev) => ({ ...prev, ...updates }));
        }
      });
    }

    return () => {
      controller.abort();
      inFlightPubs.forEach((id) => requestedPubs.delete(id));
      inFlightProfiles.forEach((id) => requestedProfiles.delete(id));
    };
  }, [sessionReady, purchases.orders, sales.orders]);

  const mappedPurchases = React.useMemo(
    () => enrichList(purchases.orders, 'COMPRA', publicationsById, profilesById, extrasByOrderId),
    [purchases.orders, publicationsById, profilesById, extrasByOrderId],
  );
  const mappedSales = React.useMemo(
    () => enrichList(sales.orders, 'VENTA', publicationsById, profilesById, extrasByOrderId),
    [sales.orders, publicationsById, profilesById, extrasByOrderId],
  );
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

  async function executeConfirmedAction() {
    if (!pendingConfirm || confirmBusy) return;
    setConfirmBusy(true);
    setExtraActionError(null);
    try {
      if (pendingConfirm.kind === 'deliver') {
        const updatedExtra = await orderExtrasService.markDelivered(pendingConfirm.orderId);
        setExtrasByOrderId((prev) => ({
          ...prev,
          [pendingConfirm.orderId]: {
            ...prev[pendingConfirm.orderId],
            ...updatedExtra,
          },
        }));
      } else if (pendingConfirm.kind === 'complete') {
        await changeStatus(pendingConfirm.orderId, 'COMPLETADA');
      } else if (pendingConfirm.kind === 'cancel') {
        await changeStatus(pendingConfirm.orderId, 'CANCELADA');
      }
      setPendingConfirm(null);
    } catch {
      setExtraActionError(
        `No pudimos completar la acción sobre ${pendingConfirm.orderNumber}. Inténtalo nuevamente.`,
      );
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function submitReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingReview || reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const created = await orderExtrasService.createReview(pendingReview.orderId, {
        rating: reviewRating,
        comentario: reviewComment,
      });
      setExtrasByOrderId((prev) => ({
        ...prev,
        [pendingReview.orderId]: {
          idOrden: pendingReview.orderId,
          notas: prev[pendingReview.orderId]?.notas ?? '',
          fechaAcordada: prev[pendingReview.orderId]?.fechaAcordada ?? '',
          vendedorConfirmoEntrega: prev[pendingReview.orderId]?.vendedorConfirmoEntrega ?? true,
          fechaEntregaVendedor: prev[pendingReview.orderId]?.fechaEntregaVendedor,
          review: created,
        },
      }));
      setPendingReview(null);
      setReviewRating(5);
      setReviewComment('');
    } catch {
      setReviewError('No pudimos guardar tu calificación. Verifica si ya fue enviada.');
    } finally {
      setReviewBusy(false);
    }
  }

  if (!hydrated) return <p role="status">Comprobando sesión...</p>;
  if (!sessionReady) return <p role="status">Inicia sesión para consultar tus órdenes.</p>;

  const confirmCopy =
    pendingConfirm?.kind === 'deliver'
      ? {
          heading: `Marcar ${pendingConfirm.orderNumber} como entregada`,
          body: `Confirmas que ya realizaste el servicio o entrega de "${pendingConfirm.title}". El comprador podrá entonces confirmar recibido conforme para cerrar la orden.`,
          cta: 'Sí, marcar entregado',
          variant: 'primary' as const,
        }
      : pendingConfirm?.kind === 'complete'
        ? {
            heading: `Confirmar recibido conforme (${pendingConfirm.orderNumber})`,
            body: `Confirmas que recibiste "${pendingConfirm.title}" conforme. La orden pasará a estado COMPLETADA y podrás calificar al vendedor.`,
            cta: 'Confirmar y completar',
            variant: 'primary' as const,
          }
        : pendingConfirm
          ? {
              heading: `Cancelar ${pendingConfirm.orderNumber}`,
              body: `¿Seguro que deseas cancelar "${pendingConfirm.title}"? Esta acción no se puede deshacer.`,
              cta: 'Sí, cancelar orden',
              variant: 'danger' as const,
            }
          : null;

  return (
    <div className="space-y-8">
      {/* 1. Tarjetas de Resumen / Métricas del Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'ALL', label: 'Todas' },
            { key: 'PENDIENTE', label: 'Pendientes' },
            { key: 'ACEPTADA', label: 'Aceptadas' },
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

        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por orden, publicación o usuario..."
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

      {extraActionError && (
        <p role="alert" className="text-sm text-red-700">
          {extraActionError}
        </p>
      )}

      {Object.entries(actions).map(([id, action]) =>
        action.error ? (
          <p key={id} role="alert" className="text-sm text-content-main">
            Orden #{id}: {action.error}
          </p>
        ) : null,
      )}

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
          {filteredOrders.map((order) => {
            const id = Number(order.id);
            const dto = activeList.orders.find((item) => item.idOrden === id);
            const isSeller = dto?.idUsuarioVendedor === userId;
            const isBuyer = dto?.idUsuarioComprador === userId;
            const action = actions[id];

            return (
              <OrderCard
                key={order.id}
                order={order}
                actionPending={action?.pending}
                onViewDetail={
                  dto?.idPublicacion
                    ? () => router.push(`/catalogo/${dto.idPublicacion}`)
                    : undefined
                }
                onContact={
                  dto?.idPublicacion
                    ? () => router.push(`/mensajes?publicacionId=${dto.idPublicacion}`)
                    : undefined
                }
                onAccept={
                  sessionReady && isSeller && dto?.estado === 'PENDIENTE'
                    ? () => void changeStatus(id, 'ACEPTADA')
                    : undefined
                }
                onDeliver={
                  sessionReady && isSeller && dto?.estado === 'ACEPTADA' && !order.sellerDelivered
                    ? () =>
                        setPendingConfirm({
                          kind: 'deliver',
                          orderId: id,
                          orderNumber: order.orderNumber,
                          title: order.title,
                        })
                    : undefined
                }
                onComplete={
                  sessionReady && isBuyer && dto?.estado === 'ACEPTADA' && order.sellerDelivered
                    ? () =>
                        setPendingConfirm({
                          kind: 'complete',
                          orderId: id,
                          orderNumber: order.orderNumber,
                          title: order.title,
                        })
                    : undefined
                }
                onCancel={
                  sessionReady &&
                  (isBuyer || isSeller) &&
                  (dto?.estado === 'PENDIENTE' || dto?.estado === 'ACEPTADA')
                    ? () =>
                        setPendingConfirm({
                          kind: 'cancel',
                          orderId: id,
                          orderNumber: order.orderNumber,
                          title: order.title,
                        })
                    : undefined
                }
                onRate={
                  sessionReady && isBuyer && dto?.estado === 'COMPLETADA' && !order.review
                    ? () => {
                        setReviewRating(5);
                        setReviewComment('');
                        setReviewError(null);
                        setPendingReview({
                          orderId: id,
                          orderNumber: order.orderNumber,
                          title: order.title,
                          sellerName: order.counterpartName,
                        });
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
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
              <Link href="/explorar">
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

      {/* Modal de Confirmación (Entrega / Cierre / Cancelación) */}
      {pendingConfirm && confirmCopy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => !confirmBusy && setPendingConfirm(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-surface-main rounded-3xl border border-border-base shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-content-main">{confirmCopy.heading}</h3>
              <p className="text-xs text-content-muted leading-relaxed">{confirmCopy.body}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={confirmBusy}
                onClick={() => setPendingConfirm(null)}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant={confirmCopy.variant}
                size="sm"
                isLoading={confirmBusy}
                onClick={() => void executeConfirmedAction()}
              >
                {confirmCopy.cta}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Calificación y Reseña */}
      {pendingReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => !reviewBusy && setPendingReview(null)}
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitReview}
            className="w-full max-w-md bg-surface-main rounded-3xl border border-border-base shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-content-main">
                Calificar a {pendingReview.sellerName}
              </h3>
              <p className="text-xs text-content-muted">
                {pendingReview.orderNumber} · {pendingReview.title}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-content-main block">Puntuación</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    disabled={reviewBusy}
                    aria-label={`${star} estrellas`}
                    className={`text-2xl cursor-pointer transition-transform hover:scale-110 ${
                      star <= reviewRating ? 'text-amber-500' : 'text-border-base'
                    }`}
                  >
                    ★
                  </button>
                ))}
                <span className="text-xs font-bold text-content-main ml-1">{reviewRating} / 5</span>
              </div>
            </div>

            <Textarea
              id="order-review-comment"
              label="Comentario (opcional)"
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
              placeholder="Cuenta brevemente cómo fue tu experiencia con este servicio..."
              disabled={reviewBusy}
            />

            {reviewError && (
              <p role="alert" className="text-xs text-red-700">
                {reviewError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={reviewBusy}
                onClick={() => setPendingReview(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={reviewBusy}>
                Enviar calificación
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
