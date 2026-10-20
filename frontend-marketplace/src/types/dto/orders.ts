/**
 * DTOs REST basados en orders.proto y orders.swagger.json.
 * Los int64 se representan como strings para conservar precisión.
 * Los Timestamp se representan como strings RFC 3339.
 */

export type EstadoOrdenDto =
  'ESTADO_ORDEN_UNSPECIFIED' | 'PENDIENTE' | 'ACEPTADA' | 'COMPLETADA' | 'CANCELADA';

export interface OrderDto {
  idOrden?: number;
  idUsuarioComprador?: number;
  idUsuarioVendedor?: number;
  idPublicacion?: number;
  estado?: EstadoOrdenDto;
  estadoStr?: string;
  precio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrdersPaginationMetaDto {
  totalRecords?: string;
  currentPage?: number;
  totalPages?: number;
  limit?: number;
}

export interface CreateOrderRequestDto {
  idUsuarioVendedor?: number;
  idPublicacion?: number;
  precio?: string;
}

export interface CreateOrderResponseDto {
  order?: OrderDto;
  message?: string;
}

export interface PatchOrderStatusRequestDto {
  idOrden: number;
  nuevoEstado?: string;
}

/** Cuerpo HTTP; idOrden se proporciona en la ruta. */
export type PatchOrderStatusBodyDto = Omit<PatchOrderStatusRequestDto, 'idOrden'>;

export interface PatchOrderStatusResponseDto {
  order?: OrderDto;
  message?: string;
}

export interface GetOrderRequestDto {
  idOrden: number;
}

export interface GetOrderResponseDto {
  order?: OrderDto;
}

export interface ListMyPurchasesRequestDto {
  page?: number;
  limit?: number;
  estado?: string;
}

export interface ListMySalesRequestDto {
  page?: number;
  limit?: number;
  estado?: string;
}

export interface ListOrdersResponseDto {
  orders?: OrderDto[];
  meta?: OrdersPaginationMetaDto;
}
