'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { apiClient } from '@/lib/apiClient';
import { chatService } from '@/services/chatService';
import { publicationService, type CatalogPublication } from '@/services/publicationService';
import { useAuthStore } from '@/store/useAuthStore';
import { getAccessToken } from '@/lib/authCookies';

type Room = NonNullable<Awaited<ReturnType<typeof chatService.getOrCreateRoom>>['sala']>;
type Message = NonNullable<Awaited<ReturnType<typeof chatService.getMessages>>['mensajes']>[number];
const buttonClass =
  'rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const refreshInterval = 5000;
const historyPageSize = 50;
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 4294967295;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 400:
        return 'El servidor rechazó los datos enviados.';
      case 401:
        return 'Tu sesión expiró. Inicia sesión nuevamente.';
      case 403:
        return 'No tienes permiso para acceder a esta conversación.';
      case 404:
        return 'La publicación o conversación ya no está disponible.';
    }
  }
  return 'No pudimos completar la solicitud. Comprueba tu conexión y vuelve a actualizar.';
}

function sameSession(userId: number, token: string): boolean {
  const current = useAuthStore.getState();
  return (
    current.isAuthenticated &&
    current.user?.id === userId &&
    current.token === token &&
    getAccessToken() === token
  );
}

function otherParticipant(room: Room, userId: number): number | null {
  if (
    !validId(room.idSala) ||
    !validId(room.compradorId) ||
    !validId(room.vendedorId) ||
    room.compradorId === room.vendedorId
  )
    return null;
  if (room.compradorId === userId) return room.vendedorId;
  if (room.vendedorId === userId) return room.compradorId;
  return null;
}

function publicationLabel(room: Room): string {
  return validId(room.publicacionId)
    ? `Publicación #${room.publicacionId}`
    : 'Conversación directa';
}

function messageTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Consulta únicamente el perfil público; no almacena perfiles globalmente
// ni muestra correos, credenciales o nombres inventados.
function useParticipantName(id: number | null) {
  const [name, setName] = useState<{ id: number; full: string; first?: string } | null>(null);
  useEffect(() => {
    if (id === null) return;
    const profileId = id;
    const controller = new AbortController();
    async function load() {
      try {
        const { data } = await apiClient.get<Record<string, unknown>>(`/v1/auth/profile/${id}`, {
          signal: controller.signal,
          timeout: 5000,
        });
        if (controller.signal.aborted || !data) return;
        const returnedId = data.userId ?? data.user_id;
        if (returnedId !== undefined && Number(returnedId) !== id) return;
        const first = data.firstName ?? data.first_name;
        const last = data.lastName ?? data.last_name;
        const fullName = [first, last]
          .filter((part): part is string => typeof part === 'string')
          .map((part) => part.trim())
          .filter(Boolean)
          .join(' ');
        if (fullName) {
          setName({
            id: profileId,
            full: fullName,
            first: typeof first === 'string' ? first.trim().split(/\s+/)[0] : undefined,
          });
        }
      } catch {
        // Un perfil no disponible no debe impedir el uso de la conversación.
      }
    }
    void load();
    return () => controller.abort();
  }, [id]);
  return name?.id === id ? name : null;
}

function ParticipantName({ id }: { id: number }) {
  return <>{useParticipantName(id)?.full || 'Nombre no disponible'}</>;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<p className="p-6">Cargando conversaciones…</p>}>
      <MessagesEntry />
    </Suspense>
  );
}

function MessagesEntry() {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const params = useSearchParams();
  const publicationId = params.get('publicacionId');
  if (!mounted) return <p className="p-6">Comprobando sesión…</p>;
  if (!isAuthenticated || !user || !validId(user.id) || !token || getAccessToken() !== token) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Conversaciones</h1>
        <p>Inicia sesión para consultar y enviar mensajes.</p>
        <Link href="/login" className="text-brand underline">
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }
  return (
    <MessagesWorkspace
      key={JSON.stringify([user.id, token, publicationId])}
      userId={user.id}
      token={token}
      publicationId={publicationId}
    />
  );
}

function MessagesWorkspace({
  userId,
  token,
  publicationId,
}: {
  userId: number;
  token: string;
  publicationId: string | null;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [publication, setPublication] = useState<CatalogPublication | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingPublication, setLoadingPublication] = useState(publicationId !== null);
  const [opening, setOpening] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [publicationError, setPublicationError] = useState('');
  const [revision, setRevision] = useState(0);
  const openingLock = useRef(false);
  const openRequest = useRef<AbortController | null>(null);
  const roomsRequest = useRef<AbortController | null>(null);

  useEffect(() => () => openRequest.current?.abort(), []);

  const refreshRooms = useCallback(() => {
    if (!sameSession(userId, token)) return;
    roomsRequest.current?.abort();
    setRevision((value) => value + 1);
  }, [userId, token]);

  useEffect(() => {
    const controller = new AbortController();
    roomsRequest.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    async function loadRooms() {
      if (controller.signal.aborted || !sameSession(userId, token)) return;
      try {
        const response = await chatService.listRooms(controller.signal);
        if (controller.signal.aborted || !sameSession(userId, token)) return;
        const result = response.salas ?? [];
        if (result.some((room) => otherParticipant(room, userId) === null))
          throw new Error('Lista inválida.');
        setRooms(result);
        if (publicationId && /^[1-9]\d*$/.test(publicationId)) {
          const targetPubId = Number(publicationId);
          const matchingRoom = result.find((room) => room.publicacionId === targetPubId);
          if (matchingRoom) {
            setSelectedRoom((current) => current ?? matchingRoom);
          }
        }
        setRoomsError('');
      } catch (error: unknown) {
        if (controller.signal.aborted || !sameSession(userId, token)) return;
        setRoomsError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted && sameSession(userId, token)) {
          setLoadingRooms(false);
          timer = setTimeout(() => void loadRooms(), refreshInterval);
        }
      }
    }
    void loadRooms();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [userId, token, revision, publicationId]);

  useEffect(() => {
    if (publicationId === null) return;
    const controller = new AbortController();
    async function loadPublication() {
      try {
        if (!/^[1-9]\d*$/.test(publicationId!) || !validId(Number(publicationId)))
          throw new Error('Identificador inválido.');
        const result = await publicationService.getPublicationById(
          publicationId!,
          controller.signal,
        );
        if (controller.signal.aborted || !sameSession(userId, token)) return;
        if (!validId(result.id) || result.id !== Number(publicationId) || !validId(result.sellerId))
          throw new Error('Publicación inválida.');
        setPublication(result);
      } catch (error: unknown) {
        if (controller.signal.aborted || !sameSession(userId, token)) return;
        setPublicationError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted && sameSession(userId, token)) setLoadingPublication(false);
      }
    }
    void loadPublication();
    return () => controller.abort();
  }, [publicationId, userId, token]);

  async function openConversation() {
    if (!publication || openingLock.current || !sameSession(userId, token)) return;
    if (publication.sellerId === userId) {
      setPublicationError('No puedes iniciar una conversación contigo mismo.');
      return;
    }
    openingLock.current = true;
    setOpening(true);
    setPublicationError('');
    const controller = new AbortController();
    openRequest.current = controller;
    try {
      const response = await chatService.getOrCreateRoom(
        { vendedorId: publication.sellerId, publicacionId: publication.id },
        controller.signal,
      );
      if (controller.signal.aborted || !sameSession(userId, token)) return;
      const room = response.sala;
      if (
        !room ||
        otherParticipant(room, userId) !== publication.sellerId ||
        room.publicacionId !== publication.id
      )
        throw new Error('Conversación no confirmada.');
      setSelectedRoom(room);
      refreshRooms();
    } catch (error: unknown) {
      if (controller.signal.aborted || !sameSession(userId, token)) return;
      setPublicationError(errorMessage(error));
    } finally {
      openingLock.current = false;
      if (!controller.signal.aborted && sameSession(userId, token)) setOpening(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[96rem] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content-main">Mis mensajes</h1>
        </div>
        <Link href="/explorar" className="text-sm font-semibold text-brand hover:underline">
          Volver a explorar →
        </Link>
      </div>
      {publicationId !== null && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          {loadingPublication && <p role="status">Cargando publicación…</p>}
          {publication && (
            <>
              <div>
                <h2 className="font-semibold text-content-main">{publication.title}</h2>
                <p className="mt-1 text-sm text-content-muted">
                  Contactar a{' '}
                  <ParticipantName key={publication.sellerId} id={publication.sellerId} />
                </p>
              </div>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void openConversation()}
                disabled={opening || publication.sellerId === userId}
              >
                {opening ? 'Abriendo…' : 'Abrir conversación'}
              </button>
              {publication.sellerId === userId && (
                <p className="w-full text-sm">
                  Esta publicación te pertenece. Selecciona una conversación de la lista para
                  responder.
                </p>
              )}
            </>
          )}
          {publicationError && (
            <p role="alert" className="w-full text-sm">
              {publicationError}
            </p>
          )}
        </section>
      )}
      <div className="grid overflow-hidden rounded-3xl border border-border-base bg-white shadow-sm md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border-base bg-white md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-2 border-b border-border-base p-4">
            <h2 className="font-bold text-content-main">Conversaciones</h2>
          </div>
          {loadingRooms && (
            <p role="status" className="p-4 text-sm">
              Cargando conversaciones…
            </p>
          )}
          {roomsError && (
            <p role="alert" className="p-4 text-sm">
              {roomsError}
            </p>
          )}
          {!loadingRooms && !roomsError && rooms.length === 0 && (
            <p className="p-4 text-sm text-content-muted">Todavía no tienes conversaciones.</p>
          )}
          <ul className="max-h-72 space-y-2 overflow-y-auto p-3 md:max-h-[650px]">
            {rooms.map((room) => {
              const participant = otherParticipant(room, userId)!;
              const selected = selectedRoom?.idSala === room.idSala;
              const count = room.mensajesNoLeidos;
              const unread = typeof count === 'number' && Number.isInteger(count) && count > 0;
              return (
                <li key={room.idSala}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-transparent bg-white hover:border-emerald-100 hover:bg-slate-50'}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-lg text-emerald-700"
                    >
                      ✉
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-content-main">
                        <ParticipantName key={participant} id={participant} />
                      </span>
                      <span className="mt-1 block text-xs text-content-muted">
                        {publicationLabel(room)}
                        {unread && (
                          <span className="font-semibold text-emerald-700">
                            {' '}
                            · {count === 1 ? 'Nuevo' : 'Nuevos'} +{count}
                          </span>
                        )}
                      </span>
                    </span>
                    {unread && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-[pulse_3s_ease-in-out_infinite]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        {selectedRoom ? (
          <Conversation
            key={selectedRoom.idSala}
            room={selectedRoom}
            userId={userId}
            token={token}
            onRefreshRooms={refreshRooms}
          />
        ) : (
          <section className="flex min-h-96 flex-col items-center justify-center gap-3 bg-slate-50/70 p-8 text-center">
            <span aria-hidden="true" className="text-4xl text-emerald-600">
              ✉
            </span>
            <h2 className="text-lg font-bold text-content-main">Selecciona una conversación</h2>
            <p className="max-w-sm text-sm text-content-muted">
              Abre un chat de la lista o contacta a alguien desde su publicación.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function Conversation({
  room,
  userId,
  token,
  onRefreshRooms,
}: {
  room: Room;
  userId: number;
  token: string;
  onRefreshRooms: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [sendError, setSendError] = useState('');
  const [readError, setReadError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const sendLock = useRef(false);
  const sendRequest = useRef<AbortController | null>(null);
  const historyOffset = useRef(0);
  const readPending = useRef(false);
  const historyPanel = useRef<HTMLDivElement | null>(null);
  const followLatest = useRef(true);
  const recipientId = otherParticipant(room, userId);
  const recipientName = useParticipantName(recipientId);
  const roomId = room.idSala;

  useEffect(() => () => sendRequest.current?.abort(), []);
  useEffect(() => {
    const panel = historyPanel.current;
    if (panel && !loading && followLatest.current) panel.scrollTop = panel.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!validId(roomId)) return;
    const salaId = roomId;
    const controller = new AbortController();
    const { signal } = controller;
    const active = () => !signal.aborted && sameSession(userId, token);
    let timer: ReturnType<typeof setTimeout>;

    async function loadHistory() {
      if (!active()) return;
      try {
        const result: Message[] = [];
        let offset = historyOffset.current;
        let total: number | undefined;
        do {
          const response = await chatService.getMessages(
            { salaId, limit: historyPageSize, offset },
            signal,
          );
          if (!active()) return;
          const page = response.mensajes ?? [];
          if (page.length === 0) break;
          if (
            page.some(
              (message) =>
                !validId(message.idMensaje) ||
                typeof message.contenido !== 'string' ||
                !(
                  (message.remitenteId === userId && message.destinatarioId === recipientId) ||
                  (message.remitenteId === recipientId && message.destinatarioId === userId)
                ),
            )
          )
            throw new Error('Historial inválido.');
          result.push(...page);
          offset += page.length;
          total ??= response.total ?? offset;
        } while (offset < total);

        if (result.length > 0) {
          historyOffset.current = offset;
          setMessages((current) => [...current, ...result]);
          if (result.some((message) => message.destinatarioId === userId && !message.leido)) {
            readPending.current = true;
          }
        }
        setHistoryError('');
        setLoading(false);
        if (readPending.current) {
          try {
            await chatService.markAsRead(salaId, signal);
            if (!active()) return;
            readPending.current = false;
            setReadError('');
            onRefreshRooms();
          } catch (error: unknown) {
            if (active()) setReadError(errorMessage(error));
          }
        }
      } catch (error: unknown) {
        if (active()) setHistoryError(errorMessage(error));
      } finally {
        if (active()) {
          setLoading(false);
          timer = setTimeout(() => void loadHistory(), refreshInterval);
        }
      }
    }
    void loadHistory();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [roomId, userId, token, recipientId, revision, onRefreshRooms]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = text.trim();
    if (
      !content ||
      sendLock.current ||
      recipientId === null ||
      !validId(room.idSala) ||
      !sameSession(userId, token)
    )
      return;
    sendLock.current = true;
    setSending(true);
    setSendError('');
    setNotice('');
    const controller = new AbortController();
    sendRequest.current = controller;
    try {
      const response = await chatService.sendMessage(
        { salaId: room.idSala, destinatarioId: recipientId, contenido: content },
        controller.signal,
      );
      if (controller.signal.aborted || !sameSession(userId, token)) return;
      if (response.mensaje?.remitenteId !== userId) throw new Error('Remitente no confirmado.');
      setText('');
      setNotice('Mensaje enviado y confirmado por el servidor.');
      followLatest.current = true;
      setRevision((value) => value + 1);
    } catch (error: unknown) {
      if (controller.signal.aborted || !sameSession(userId, token)) return;
      setSendError(
        `${errorMessage(error)} Comprueba el historial antes de reenviar para evitar duplicados.`,
      );
    } finally {
      sendLock.current = false;
      if (!controller.signal.aborted && sameSession(userId, token)) setSending(false);
    }
  }

  return (
    <section className="flex min-w-0 flex-col bg-slate-50/80">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-base bg-white p-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-content-main">
            {recipientName?.full || 'Nombre no disponible'}
          </h2>
          <p className="mt-1 text-xs text-content-muted">{publicationLabel(room)}</p>
        </div>
      </header>
      <div
        ref={historyPanel}
        className="h-[360px] overflow-y-auto px-4 py-6 sm:h-[430px] sm:px-6"
        aria-label="Historial de mensajes"
        aria-busy={loading}
        onScroll={({ currentTarget }) => {
          const { scrollHeight, scrollTop, clientHeight } = currentTarget;
          followLatest.current = scrollHeight - scrollTop - clientHeight <= 48;
        }}
      >
        {historyError && (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-white p-4 text-sm text-red-700"
          >
            {historyError}
          </p>
        )}
        {loading && (
          <p role="status" className="py-8 text-center text-sm text-content-muted">
            Cargando mensajes…
          </p>
        )}
        {!loading && !historyError && messages.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-semibold text-content-main">Todavía no hay mensajes</p>
            <p className="mt-2 text-sm text-content-muted">
              Escribe abajo para iniciar la conversación.
            </p>
          </div>
        )}
        <ul className="space-y-4">
          {messages.map((message) => {
            const own = message.remitenteId === userId;
            const senderName = own ? 'Tú' : recipientName?.first;
            const time = messageTime(message.createdAt);
            return (
              <li
                key={message.idMensaje}
                className={`flex ${own ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`min-w-0 max-w-[88%] rounded-2xl border px-4 py-2.5 shadow-sm sm:max-w-[72%] ${own ? 'rounded-br-sm border-emerald-100 bg-[#f0faf4]' : 'rounded-bl-sm border-slate-200 bg-white'}`}
                >
                  {senderName && (
                    <p
                      className={`mb-1 text-xs font-bold ${own ? 'text-emerald-800' : 'text-slate-600'}`}
                    >
                      {senderName}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-800">
                    {message.contenido}
                  </p>
                  {time && (
                    <time
                      dateTime={message.createdAt}
                      className="mt-2 block text-right text-[11px] text-slate-500"
                    >
                      {time}
                    </time>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <form
        onSubmit={(event) => void send(event)}
        className="space-y-3 border-t border-border-base bg-white p-4 sm:px-6"
      >
        <label htmlFor="chat-message" className="block text-sm font-semibold text-content-main">
          Escribe tu mensaje
        </label>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <textarea
            id="chat-message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (!event.repeat) event.currentTarget.form?.requestSubmit();
            }}
            disabled={sending}
            rows={2}
            placeholder="Escribe aquí…"
            className="h-[66px] min-w-0 resize-none overflow-y-auto rounded-2xl border border-border-base bg-slate-50 p-3 text-sm leading-5 text-content-main outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 sm:flex-1"
          />
          <button
            type="submit"
            className={`${buttonClass} sm:mb-1`}
            disabled={sending || !text.trim() || recipientId === null}
          >
            {sending ? 'Enviando…' : 'Enviar →'}
          </button>
        </div>
        {notice && (
          <p role="status" className="text-xs text-emerald-800">
            {notice}
          </p>
        )}
        {sendError && (
          <p role="alert" className="text-sm text-red-700">
            {sendError}
          </p>
        )}
        {readError && (
          <p role="alert" className="text-sm text-red-700">
            {readError}
          </p>
        )}
      </form>
    </section>
  );
}
