'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { PurchaseConfirmationModal } from '@/components/shared/purchase-confirmation-modal';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/useAuthStore';
import { getAccessToken } from '@/lib/authCookies';
import {
  PublicationDetailHero,
  PublicationDetailContact,
  PublicationDetailSidebar,
} from '@/components/shared';
import { publicationService, type CatalogPublication } from '@/services/publicationService';

type DetailState =
  | { status: 'loading' }
  | { status: 'success'; publication: CatalogPublication }
  | { status: 'not-found' }
  | { status: 'error' };

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  return <PublicationDetail key={id} id={id} />;
}

function PublicationDetail({ id }: { id: string }) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });
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

        if (!controller.signal.aborted) {
          setState({ status: 'success', publication });
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

  function retry() {
    setState({ status: 'loading' });
    setRetryCount((previous) => previous + 1);
  }

  function validatePurchase(): string | null {
    if (state.status !== 'success') return 'La publicación no está disponible.';

    const { user, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !user || !getAccessToken()) {
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

  async function confirmPurchase() {
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
      const result = await orderService.createOrder({
        idUsuarioVendedor: state.publication.sellerId,
        idPublicacion: state.publication.id,
        precio: String(state.publication.price),
      });

      const orderId = result.order?.idOrden;
      if (!Number.isInteger(orderId) || (orderId ?? 0) <= 0) {
        throw new Error('La API no devolvió un identificador de orden válido.');
      }

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
              actionText={createdOrderId !== null ? 'Orden creada' : 'Contratar'}
              onAction={createdOrderId === null && !isPurchasing ? openPurchase : undefined}
            />

            {purchaseError && !isPurchaseOpen && (
              <p role="alert" className="text-sm text-content-main">
                {purchaseError}
              </p>
            )}

            {createdOrderId !== null && (
              <p role="status" className="text-sm text-content-main">
                Orden {createdOrderId} creada correctamente.
              </p>
            )}

            <PublicationDetailContact
              sellerId={publication.sellerId}
              sellerName={publication.sellerName}
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
            },
          }}
        />
      )}
    </main>
  );
}
