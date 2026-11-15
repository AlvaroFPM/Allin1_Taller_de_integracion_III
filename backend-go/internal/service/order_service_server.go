package service

import (
	"context"
	"math"
	"strings"

	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// OrderServiceServer implementa la interfaz gRPC OrderServiceServer generada por Protobuf.
// Actúa como adaptador entre el transporte gRPC/Gateway y el servicio de dominio OrderService.
type OrderServiceServer struct {
	orderspb.UnimplementedOrderServiceServer
	orderService *OrderService
}

// NewOrderServiceServer crea una nueva instancia del servidor gRPC de órdenes.
func NewOrderServiceServer(orderService *OrderService) *OrderServiceServer {
	return &OrderServiceServer{
		orderService: orderService,
	}
}

// ModelToProtoOrder convierte una entidad de dominio models.Orden al mensaje protobuf orders.Order.
func ModelToProtoOrder(o *models.Orden) *orderspb.Order {
	if o == nil {
		return nil
	}

	var estadoEnum orderspb.EstadoOrden
	switch o.Estado {
	case models.EstadoOrdenPendiente:
		estadoEnum = orderspb.EstadoOrden_PENDIENTE
	case models.EstadoOrdenAceptada:
		estadoEnum = orderspb.EstadoOrden_ACEPTADA
	case models.EstadoOrdenCompletada:
		estadoEnum = orderspb.EstadoOrden_COMPLETADA
	case models.EstadoOrdenCancelada:
		estadoEnum = orderspb.EstadoOrden_CANCELADA
	default:
		estadoEnum = orderspb.EstadoOrden_ESTADO_ORDEN_UNSPECIFIED
	}

	var createdAtPb, updatedAtPb *timestamppb.Timestamp
	if !o.CreatedAt.IsZero() {
		createdAtPb = timestamppb.New(o.CreatedAt)
	}
	if !o.UpdatedAt.IsZero() {
		updatedAtPb = timestamppb.New(o.UpdatedAt)
	}

	return &orderspb.Order{
		IdOrden:            uint32(o.IDOrden),
		IdUsuarioComprador: uint32(o.IDUsuarioComprador),
		IdUsuarioVendedor:  uint32(o.IDUsuarioVendedor),
		IdPublicacion:      uint32(o.IDPublicacion),
		Estado:             estadoEnum,
		EstadoStr:          o.Estado,
		Precio:             o.Precio,
		CreatedAt:          createdAtPb,
		UpdatedAt:          updatedAtPb,
	}
}

// CreateOrder adapta la petición gRPC de creación de orden.
// Extrae el comprador autenticado desde el contexto JWT y delega en el OrderService de dominio.
func (s *OrderServiceServer) CreateOrder(ctx context.Context, req *orderspb.CreateOrderRequest) (*orderspb.CreateOrderResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "la solicitud de creación es requerida")
	}

	compradorID := extractUserID(ctx)
	if compradorID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado o token inválido")
	}

	vendedorID := uint(req.GetIdUsuarioVendedor())
	publicacionID := uint(req.GetIdPublicacion())
	precio := req.GetPrecio()

	orden, err := s.orderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)
	if err != nil {
		return nil, err
	}

	return &orderspb.CreateOrderResponse{
		Order:   ModelToProtoOrder(orden),
		Message: "Orden creada exitosamente",
	}, nil
}

// PatchOrderStatus adapta la petición gRPC de actualización de estado de orden.
// Valida identidad del solicitante y delega en el OrderService aplicando FSM y autorización.
func (s *OrderServiceServer) PatchOrderStatus(ctx context.Context, req *orderspb.PatchOrderStatusRequest) (*orderspb.PatchOrderStatusResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "la solicitud de actualización es requerida")
	}

	usuarioID := extractUserID(ctx)
	if usuarioID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado o token inválido")
	}

	ordenID := uint(req.GetIdOrden())
	nuevoEstado := strings.TrimSpace(req.GetNuevoEstado())

	orden, err := s.orderService.PatchOrderStatus(ctx, ordenID, usuarioID, nuevoEstado)
	if err != nil {
		return nil, err
	}

	return &orderspb.PatchOrderStatusResponse{
		Order:   ModelToProtoOrder(orden),
		Message: "Estado de la orden actualizado exitosamente",
	}, nil
}

// GetOrder registra expresamente la operación como pendiente para sprints posteriores (ALL-137).
func (s *OrderServiceServer) GetOrder(ctx context.Context, req *orderspb.GetOrderRequest) (*orderspb.GetOrderResponse, error) {
	return nil, status.Error(codes.Unimplemented, "operación GetOrder no implementada en esta fase (registrada para sprint posterior)")
}

// ListMyPurchases adapta la petición gRPC para consultar las compras del usuario autenticado.
func (s *OrderServiceServer) ListMyPurchases(ctx context.Context, req *orderspb.ListMyPurchasesRequest) (*orderspb.ListOrdersResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "la solicitud de listado de compras es requerida")
	}

	compradorID := extractUserID(ctx)
	if compradorID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado o token inválido")
	}

	var estadoPtr *string
	if req.Estado != nil {
		estadoPtr = req.Estado
	}

	ordenes, totalRecords, err := s.orderService.ListMyPurchases(ctx, compradorID, req.GetPage(), req.GetLimit(), estadoPtr)
	if err != nil {
		return nil, err
	}

	return buildListOrdersResponse(ordenes, totalRecords, req.GetPage(), req.GetLimit()), nil
}

// ListMySales adapta la petición gRPC para consultar las ventas del usuario autenticado.
func (s *OrderServiceServer) ListMySales(ctx context.Context, req *orderspb.ListMySalesRequest) (*orderspb.ListOrdersResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "la solicitud de listado de ventas es requerida")
	}

	vendedorID := extractUserID(ctx)
	if vendedorID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado o token inválido")
	}

	var estadoPtr *string
	if req.Estado != nil {
		estadoPtr = req.Estado
	}

	ordenes, totalRecords, err := s.orderService.ListMySales(ctx, vendedorID, req.GetPage(), req.GetLimit(), estadoPtr)
	if err != nil {
		return nil, err
	}

	return buildListOrdersResponse(ordenes, totalRecords, req.GetPage(), req.GetLimit()), nil
}

// buildListOrdersResponse construye el mensaje de respuesta protobuf con metadatos de paginación.
func buildListOrdersResponse(ordenes []models.Orden, totalRecords int64, page, limit int32) *orderspb.ListOrdersResponse {
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	var totalPages int32
	if totalRecords > 0 {
		totalPages = int32(math.Ceil(float64(totalRecords) / float64(limit)))
	}

	protoOrders := make([]*orderspb.Order, 0, len(ordenes))
	for i := range ordenes {
		protoOrders = append(protoOrders, ModelToProtoOrder(&ordenes[i]))
	}

	return &orderspb.ListOrdersResponse{
		Orders: protoOrders,
		Meta: &orderspb.PaginationMeta{
			TotalRecords: totalRecords,
			CurrentPage:  page,
			TotalPages:   totalPages,
			Limit:        limit,
		},
	}
}
