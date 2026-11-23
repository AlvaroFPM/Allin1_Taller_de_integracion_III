import api from '@/lib/axios';
import type {
  GetMessagesRequestDto,
  GetMessagesResponseDto,
  GetOrCreateRoomRequestDto,
  GetOrCreateRoomResponseDto,
  ListRoomsResponseDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
} from '@/types/dto/chat';

const CHAT_API_URL = (process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8085').replace(
  /\/+$/,
  '',
);

export const chatService = {
  getOrCreateRoom: async (
    request: GetOrCreateRoomRequestDto,
    signal?: AbortSignal,
  ): Promise<GetOrCreateRoomResponseDto> => {
    const response = await api.post<GetOrCreateRoomResponseDto>(
      `${CHAT_API_URL}/v1/chat/rooms`,
      request,
      { signal },
    );

    if (!response.data?.sala?.idSala) {
      throw new Error('Chat no devolvió una sala válida.');
    }

    return response.data;
  },

  listRooms: async (signal?: AbortSignal): Promise<ListRoomsResponseDto> => {
    const response = await api.get<ListRoomsResponseDto>(`${CHAT_API_URL}/v1/chat/rooms`, {
      signal,
    });

    if (!Array.isArray(response.data?.salas)) {
      throw new Error('Chat no devolvió una lista de salas válida.');
    }

    return response.data;
  },

  sendMessage: async (
    request: SendMessageRequestDto,
    signal?: AbortSignal,
  ): Promise<SendMessageResponseDto> => {
    const response = await api.post<SendMessageResponseDto>(
      `${CHAT_API_URL}/v1/chat/messages`,
      request,
      { signal },
    );

    const mensaje = response.data?.mensaje;
    if (
      !mensaje?.idMensaje ||
      mensaje.salaId !== request.salaId ||
      mensaje.destinatarioId !== request.destinatarioId
    ) {
      throw new Error('Chat no confirmó correctamente el mensaje enviado.');
    }

    return response.data;
  },

  getMessages: async (
    request: GetMessagesRequestDto,
    signal?: AbortSignal,
  ): Promise<GetMessagesResponseDto> => {
    const { salaId, limit, offset } = request;

    const response = await api.get<GetMessagesResponseDto>(
      `${CHAT_API_URL}/v1/chat/rooms/${salaId}/messages`,
      {
        params: { limit, offset },
        signal,
      },
    );

    if (
      !Array.isArray(response.data?.mensajes) ||
      !Number.isInteger(response.data.total) ||
      (response.data.total ?? -1) < 0 ||
      response.data.mensajes.some((mensaje) => mensaje.salaId !== salaId)
    ) {
      throw new Error('Chat no devolvió un historial válido para esta sala.');
    }

    return response.data;
  },
};
