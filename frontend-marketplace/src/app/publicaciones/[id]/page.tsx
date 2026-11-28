'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { PurchaseConfirmationModal } from '@/components/shared/purchase-confirmation-modal';
import { orderService } from '@/services/orderService';
import { ordersQueryService } from '@/services/ordersQueryService';
import { orderExtrasService } from '@/services/orderExtrasService';
import { chatService } from '@/services/chatService';
import { useAuthStore } from '@/store/useAuthStore';
import { getAccessToken } from '@/lib/authCookies';
import {
  PublicationDetailHero,
  PublicationDetailGallery,
  PublicationDetailContact,
  PublicationDetailSidebar,
} from '@/components/shared';
import { publicationService, type CatalogPublication } from '@/services/publicationService';
import { getPublicProfile } from '@/services/authService';
import type { PurchaseConfirmationDetails } from '@/types/order';
import type { OrderDto } from '@/types/dto/orders';

type DetailState =
  | { status: 'loading' }
  | { status: 'success'; publication: CatalogPublication }
  | { status: 'not-found' }
  | { status: 'error' };

function subscribeToHydration(listener: () => void) {
  const start = useAuthStore.persist.onHydrate(() => listener());
  const finish = useAuthStore.persist.onFinishHydration(() => listener());
  return () => {
    start();
    finish();
  };
}

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  return <PublicationDetail key={id} id={id} />;
}

function PublicationDetail({ id }: { id: string }) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );

  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [sellerRating, setSellerRating] = useState<{ score: number; count: number } | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderDto | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const purchaseLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPublication() {
      try {
        const publication = await publicationService.getPublicationById(id, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        // Renderizar la publicación de inmediato sin bloquear por latencia de IAM
        setState({
          status: 'success',
          publication: {
            ...publication,
            sellerName: undefined,
            sellerAvatarUrl: undefined,
          },
        });

        if (Number.isInteger(publication.sellerId) && publication.sellerId > 0) {
          const [profile, reviewsSummary] = await Promise.all([
            getPublicProfile(publication.sellerId, controller.signal).catch(() => null),
            orderExtrasService
              .getUserReviews(publication.sellerId, controller.signal)
              .catch(() => null),
          ]);

          if (controller.signal.aborted) return;

          if (profile && profile.userId === publication.sellerId) {
            const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
            const avatarUrl = profile.fotoPerfilUrl?.trim() || undefined;
            setState((prev) =>
              prev.status === 'success' && prev.publication.id === publication.id
                ? {
                    status: 'success',
                    publication: {
                      ...prev.publication,
                      sellerName: fullName || prev.publication.sellerName,
                      sellerAvatarUrl: avatarUrl,
                    },
                  }
                : prev,
            );
          }

          if (reviewsSummary && reviewsSummary.totalReviews > 0) {
            setSellerRating({
              score: reviewsSummary.averageScore,
              count: reviewsSummary.totalReviews,
            });
          } else {
            setSellerRating(null);
          }
        }
      } catch (error: unknown) {
        if (controller.signal.aborted || axios.isCancel(error)) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setState({ status: 'not-found' });
          return;
        }

        setState({ status: 'error' });
      }
    }

    void loadPublication();

    return () => controller.abort();
  }, [id, retryCount]);

  // Comprobar si ya existe una orden activa (en compras o en ventas si es propia)
  const loadedPubId = state.status === 'success' ? state.publication.id : null;
  const loadedSellerId = state.status === 'success' ? state.publication.sellerId : null;
  const sessionReady = hydrated && isAuthenticated && Boolean(currentUser?.id) && Boolean(token);
  const isOwnPublication =
    sessionReady && loadedSellerId !== null && currentUser?.id === loadedSellerId;

  useEffect(() => {
    if (!sessionReady || loadedPubId === null) return;
    const controller = new AbortController();

    const query = isOwnPublication
      ? ordersQueryService.getSales({ limit: 50 }, controller.signal)
      : ordersQueryService.getPurchases({ limit: 50 }, controller.signal);

    query
      .then((res) => {
        if (controller.signal.aborted) return;
        const found = (res.orders ?? []).find(
          (ord) =>
            ord.idPublicacion === loadedPubId &&
            (ord.estado === 'PENDIENTE' || ord.estado === 'ACEPTADA'),
        );
        setActiveOrder(found ?? null);
      })
      .catch(() => {
        // Degradación segura si Orders no está disponible
      });

    return () => controller.abort();
  }, [sessionReady, loadedPubId, isOwnPublication, createdOrderId]);

  function retry() {
    setState({ status: 'loading' });
    setRetryCount((previous) => previous + 1);
  }

  function validatePurchase(): string | null {
    if (state.status !== 'success') return 'La publicación no está disponible.';

    const { user, isAuthenticated: authed } = useAuthStore.getState();
    if (!authed || !user || !getAccessToken()) {
      return 'Inicia sesión para contratar.';
    }

    const { publication } = state;
    if (
      !Number.isInteger(publication.id) ||
      publication.id <= 0 ||
      !Number.isInteger(publication.sellerId) ||
      publication.sellerId <= 0
    ) {
      return 'La publicación no contiene identificadores válidos.';
    }

    if (user.id === publication.sellerId) {
      return 'No puedes contratar tu propia publicación.';
    }

    if (!Number.isSafeInteger(publication.price) || publication.price <= 0) {
      return 'El precio no permite crear una orden sin perder precisión.';
    }

    if (publication.type === 'DEMANDA') {
      return 'La contratación de DEMANDA aún no está habilitada: falta confirmar cómo el backend aplica los roles de comprador y vendedor.';
    }

    return null;
  }

  function openPurchase() {
    if (purchaseLock.current || createdOrderId !== null) return;
    const error = validatePurchase();
    setPurchaseError(error);
    if (!error) setIsPurchaseOpen(true);
  }

  function closePurchase() {
    if (!purchaseLock.current) setIsPurchaseOpen(false);
  }

  async function confirmPurchase(details?: PurchaseConfirmationDetails) {
    if (purchaseLock.current || createdOrderId !== null) return;
    const error = validatePurchase();
    if (error || state.status !== 'success') {
      setPurchaseError(error);
      return;
    }

    purchaseLock.current = true;
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const pub = state.publication;
      const result = await orderService.createOrder({
        idUsuarioVendedor: pub.sellerId,
        idPublicacion: pub.id,
        precio: String(pub.price),
      });

      const orderId = result.order?.idOrden;
      if (!Number.isInteger(orderId) || (orderId ?? 0) <= 0) {
        throw new Error('La API no devolvió un identificador de orden válido.');
      }

      // Persistir fecha/horario y notas en order_extras (best-effort sin revertir la orden)
      const trimmedNotes = details?.notes?.trim() ?? '';
      const trimmedDate = details?.scheduledDate?.trim() ?? '';
      if (trimmedNotes || trimmedDate) {
        await orderExtrasService
          .saveExtras(orderId!, { notas: trimmedNotes, fechaAcordada: trimmedDate })
          .catch(() => {});
      }

      // Enviar primer mensaje automático al chat para iniciar la coordinación (best-effort)
      void (async () => {
        try {
          const roomRes = await chatService.getOrCreateRoom({
            vendedorId: pub.sellerId,
            publicacionId: pub.id,
          });
          const salaId = roomRes.sala?.idSala;
          if (!salaId) return;

          const lines = [`Hola, acabo de contratar "${pub.title}" (Orden #${orderId}).`];
          if (trimmedDate) lines.push(`Fecha/lugar sugerido: ${trimmedDate}`);
          if (trimmedNotes) lines.push(`Notas: ${trimmedNotes}`);
          else lines.push('Quedo atento para coordinar los detalles.');

          await chatService.sendMessage({
            salaId,
            destinatarioId: pub.sellerId,
            contenido: lines.join('\n'),
          });
        } catch {
          // Si Chat no está levantado, no bloquea ni falla la orden creada
        }
      })();

      setCreatedOrderId(orderId!);
      setIsPurchaseOpen(false);
    } catch (error: unknown) {
      let message =
        'No pudimos confirmar la creación. Comprueba tus órdenes antes de reintentar para evitar duplicados.';

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          message = 'Tu sesión expiró. Inicia sesión nuevamente.';
        } else if (error.response?.status === 403) {
          message = 'No tienes permiso para realizar esta contratación.';
        } else if (error.response?.status === 409) {
          message =
            'La solicitud presenta un conflicto. Comprueba si ya tienes una orden para esta publicación.';
        } else if (error.response?.status === 400) {
          message = 'El servidor rechazó los datos de la contratación.';
        }
      }

      setPurchaseError(message);
    } finally {
      purchaseLock.current = false;
      setIsPurchasing(false);
    }
  }

  if (state.status !== 'success') {
    return (
      <main className="min-h-screen bg-surface-base py-8">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Link href="/explorar" className="text-brand underline">
            Volver a explorar
          </Link>

          <section className="rounded-3xl border border-border-base bg-surface-main p-6 shadow-2xs sm:p-8">
            {state.status === 'loading' && (
              <p role="status" className="text-content-muted">
                Cargando publicación…
              </p>
            )}

            {state.status === 'not-found' && (
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-content-main">Publicación no encontrada</h1>
                <p className="text-content-muted">
                  No encontramos una publicación con este identificador.
                </p>
              </div>
            )}

            {state.status === 'error' && (
              <div role="alert" className="space-y-4">
                <h1 className="text-2xl font-bold text-content-main">
                  No pudimos cargar la publicación
                </h1>
                <p className="text-content-muted">Inténtalo nuevamente.</p>
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-lg bg-brand px-4 py-2 font-semibold text-white"
                >
                  Reintentar
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  const { publication } = state;

  let sidebarNotice: string | undefined;
  let sidebarLinkHref: string | undefined;
  let sidebarLinkText: string | undefined;
  let hideAction = false;

  if (isOwnPublication) {
    hideAction = true;
    sidebarNotice = activeOrder
      ? `Esta es tu publicación · Tienes la Orden #${activeOrder.idOrden} en curso (${activeOrder.estado}).`
      : 'Esta publicación te pertenece.';
    sidebarLinkHref = '/ordenes';
    sidebarLinkText = activeOrder ? 'Gestionar en Mis Ventas →' : 'Ir a Mis Órdenes →';
  } else if (createdOrderId !== null || activeOrder) {
    const orderNum = createdOrderId ?? activeOrder?.idOrden;
    hideAction = true;
    sidebarNotice = `Ya tienes una orden en curso (Orden #${orderNum}).`;
    sidebarLinkHref = '/ordenes';
    sidebarLinkText = 'Ver en Mis Compras →';
  }

  return (
    <main className="min-h-screen bg-surface-base py-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:space-y-8 sm:px-6 lg:px-8">
        <PublicationDetailHero
          title={publication.title}
          type={publication.type}
          publishedRelative={publication.createdAtRelative}
        />

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-6 sm:space-y-8 lg:col-span-8">
            <PublicationDetailGallery images={publication.images ?? []} title={publication.title} />
            <section className="space-y-4 rounded-3xl border border-border-base bg-surface-main p-6 shadow-2xs sm:p-8">
              <h2 className="text-lg font-bold text-content-main sm:text-xl">Descripción</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-content-main/90 sm:text-base">
                {publication.description}
              </p>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-4">
            <PublicationDetailSidebar
              price={publication.price}
              currency={publication.currency}
              priceLabel="Precio publicado"
              actionText="Contratar"
              onAction={!hideAction && !isPurchasing ? openPurchase : undefined}
              hideAction={hideAction}
              notice={sidebarNotice}
              linkHref={sidebarLinkHref}
              linkText={sidebarLinkText}
            />

            {purchaseError && !isPurchaseOpen && (
              <p role="alert" className="text-sm text-red-700">
                {purchaseError}
              </p>
            )}

            {createdOrderId !== null && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5 text-sm text-emerald-950">
                <p role="status" className="font-semibold">
                  Orden #{createdOrderId} creada correctamente.
                </p>
                <p className="text-xs text-emerald-800">
                  Enviamos un mensaje inicial al vendedor para coordinar por chat.
                </p>
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  <Link href="/ordenes" className="font-bold text-brand underline">
                    Ver mis compras
                  </Link>
                  <Link
                    href={`/mensajes?publicacionId=${publication.id}`}
                    className="font-bold text-brand underline"
                  >
                    Ir al chat
                  </Link>
                </div>
              </div>
            )}

            <PublicationDetailContact
              sellerId={publication.sellerId}
              sellerName={publication.sellerName}
              avatarUrl={publication.sellerAvatarUrl}
              rating={sellerRating?.score}
              reviewsCount={sellerRating?.count}
              isOwnPublication={isOwnPublication}
              onSendMessage={
                !isOwnPublication &&
                Number.isInteger(publication.id) &&
                publication.id > 0 &&
                Number.isInteger(publication.sellerId) &&
                publication.sellerId > 0
                  ? () => router.push(`/mensajes?publicacionId=${publication.id}`)
                  : undefined
              }
            />
          </aside>
        </div>
      </div>

      {isPurchaseOpen && (
        <PurchaseConfirmationModal
          isOpen={isPurchaseOpen}
          onClose={closePurchase}
          onConfirm={confirmPurchase}
          isLoading={isPurchasing}
          errorMessage={purchaseError}
          item={{
            id: publication.id,
            title: publication.title,
            type: 'PUBLICACION',
            price: publication.price,
            currency: publication.currency,
            seller: {
              id: publication.sellerId,
              name: publication.sellerName?.trim() || 'Nombre no disponible',
              avatarUrl: publication.sellerAvatarUrl,
            },
          }}
        />
      )}
    </main>
  );
}
