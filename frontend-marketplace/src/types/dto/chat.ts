/**
 * DTOs REST basados en chat.proto y chat.swagger.json.
 * Los identificadores uint32 se representan como numbers.
 * Los Timestamp se representan como strings RFC 3339.
 */

export interface ChatMessageDto {
  idMensaje?: number;
  salaId?: number;
  remitenteId?: number;
  destinatarioId?: number;
  contenido?: string;
  leido?: boolean;
  createdAt?: string;
}

export interface ChatRoomDto {
  idSala?: number;
  compradorId?: number;
  vendedorId?: number;
  publicacionId?: number;
  ultimoMensaje?: ChatMessageDto;
  mensajesNoLeidos?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SendMessageRequestDto {
  salaId?: number;
  destinatarioId?: number;
  contenido?: string;
}

export interface SendMessageResponseDto {
  mensaje?: ChatMessageDto;
  message?: string;
}

export interface GetMessagesRequestDto {
  salaId: number;
  limit?: number;
  offset?: number;
}

export interface GetMessagesResponseDto {
  mensajes?: ChatMessageDto[];
  total?: number;
}

export interface GetOrCreateRoomRequestDto {
  vendedorId?: number;
  publicacionId?: number;
}

export interface GetOrCreateRoomResponseDto {
  sala?: ChatRoomDto;
}

export type ListRoomsRequestDto = Record<string, never>;

export interface ListRoomsResponseDto {
  salas?: ChatRoomDto[];
}

export interface MarkAsReadRequestDto {
  salaId: number;
}

/** Cuerpo HTTP vacío; salaId se proporciona en la ruta. */
export type MarkAsReadBodyDto = Record<string, never>;

export interface MarkAsReadResponseDto {
  success?: boolean;
  message?: string;
}

export type GetUnreadCountRequestDto = Record<string, never>;

export interface GetUnreadCountResponseDto {
  unreadCount?: number;
}
