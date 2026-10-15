'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { publicationService, type CatalogPublication } from '@/services/publicationService';

type DetailState =
  | { status: 'loading' }
  | { status: 'success'; publication: CatalogPublication }
  | { status: 'not-found' }
  | { status: 'error' };

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Reinicia el estado si cambia el ID de la ruta.
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/explorar" className="text-sm text-emerald-700 underline">
        Volver a explorar
      </Link>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {state.status === 'loading' && <p role="status">Cargando publicación…</p>}

        {state.status === 'not-found' && (
          <div>
            <h1 className="text-2xl font-bold">Publicación no encontrada</h1>
            <p className="mt-3">No encontramos una publicación con este identificador.</p>
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert">
            <p>No pudimos cargar la publicación. Inténtalo nuevamente.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-white"
            >
              Reintentar
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <article>
            <p className="text-sm text-gray-600">{state.publication.type}</p>

            <h1 className="mt-2 text-3xl font-bold">{state.publication.title}</h1>

            <p className="mt-4 text-2xl font-semibold text-emerald-700">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: state.publication.currency,
                maximumFractionDigits: 0,
              }).format(state.publication.price)}
            </p>

            <h2 className="mt-6 text-lg font-semibold">Descripción</h2>

            <p className="mt-2 whitespace-pre-wrap">{state.publication.description}</p>

            <p className="mt-6 text-sm text-gray-600">
              Publicado: {state.publication.createdAtRelative}
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
