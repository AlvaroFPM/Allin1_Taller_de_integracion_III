'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
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
              actionText="Acción no disponible"
            />

            <PublicationDetailContact
              sellerId={publication.sellerId}
              sellerName={publication.sellerName}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
