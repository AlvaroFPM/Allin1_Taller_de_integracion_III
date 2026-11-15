package service

import (
	"context"
	"testing"
	"time"

	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func authenticatedContext(userID uint) context.Context {
	return context.WithValue(context.Background(), middleware.UserIDKey, userID)
}

func TestOrderServiceServer_CreateOrder_Validations(t *testing.T) {
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	t.Run("nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.CreateOrder(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("sin usuario autenticado retorna Unauthenticated", func(t *testing.T) {
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 2,
			IdPublicacion:     10,
			Precio:            15000,
		}
		resp, err := server.CreateOrder(context.Background(), req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("comprador igual a vendedor (RN-21) retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(5)
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 5, // mismo ID
			IdPublicacion:     10,
			Precio:            15000,
		}
		resp, err := server.CreateOrder(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), "RN-21")
	})

	t.Run("precio menor o igual a cero (RN-23) retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(1)
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 2,
			IdPublicacion:     10,
			Precio:            -500,
		}
		resp, err := server.CreateOrder(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), "RN-23")
	})
}

func TestOrderServiceServer_PatchOrderStatus_Validations(t *testing.T) {
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	t.Run("nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.PatchOrderStatus(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("sin usuario autenticado retorna Unauthenticated", func(t *testing.T) {
		req := &orderspb.PatchOrderStatusRequest{
			IdOrden:     1,
			NuevoEstado: "ACEPTADA",
		}
		resp, err := server.PatchOrderStatus(context.Background(), req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("id_orden en cero retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(1)
		req := &orderspb.PatchOrderStatusRequest{
			IdOrden:     0,
			NuevoEstado: "ACEPTADA",
		}
		resp, err := server.PatchOrderStatus(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}

func TestOrderServiceServer_GetOrder_Unimplemented(t *testing.T) {
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	// Registra expresamente la operación como pendiente (ALL-137)
	resp, err := server.GetOrder(context.Background(), &orderspb.GetOrderRequest{IdOrden: 1})
	require.Error(t, err)
	assert.Nil(t, resp)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
	assert.Contains(t, err.Error(), "GetOrder no implementada")
}

func TestOrderServiceServer_ListOrders_Validations(t *testing.T) {
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	t.Run("ListMyPurchases nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.ListMyPurchases(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("ListMyPurchases sin autenticacion retorna Unauthenticated", func(t *testing.T) {
		resp, err := server.ListMyPurchases(context.Background(), &orderspb.ListMyPurchasesRequest{})
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("ListMySales nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.ListMySales(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("ListMySales sin autenticacion retorna Unauthenticated", func(t *testing.T) {
		resp, err := server.ListMySales(context.Background(), &orderspb.ListMySalesRequest{})
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unauthenticated, status.Code(err))
	})
}

func TestModelToProtoOrder(t *testing.T) {
	t.Run("nil models.Orden retorna nil", func(t *testing.T) {
		assert.Nil(t, ModelToProtoOrder(nil))
	})

	t.Run("mapeo completo de campos y enums de estado", func(t *testing.T) {
		now := time.Now()
		casos := []struct {
			estadoStr  string
			estadoEnum orderspb.EstadoOrden
		}{
			{models.EstadoOrdenPendiente, orderspb.EstadoOrden_PENDIENTE},
			{models.EstadoOrdenAceptada, orderspb.EstadoOrden_ACEPTADA},
			{models.EstadoOrdenCompletada, orderspb.EstadoOrden_COMPLETADA},
			{models.EstadoOrdenCancelada, orderspb.EstadoOrden_CANCELADA},
			{"OTRO_DESCONOCIDO", orderspb.EstadoOrden_ESTADO_ORDEN_UNSPECIFIED},
		}

		for _, tc := range casos {
			orden := &models.Orden{
				IDOrden:            101,
				IDUsuarioComprador: 5,
				IDUsuarioVendedor:  8,
				IDPublicacion:      20,
				Estado:             tc.estadoStr,
				Precio:             25000,
				CreatedAt:          now,
				UpdatedAt:          now,
			}

			proto := ModelToProtoOrder(orden)
			require.NotNil(t, proto)
			assert.Equal(t, uint32(101), proto.GetIdOrden())
			assert.Equal(t, uint32(5), proto.GetIdUsuarioComprador())
			assert.Equal(t, uint32(8), proto.GetIdUsuarioVendedor())
			assert.Equal(t, uint32(20), proto.GetIdPublicacion())
			assert.Equal(t, tc.estadoEnum, proto.GetEstado())
			assert.Equal(t, tc.estadoStr, proto.GetEstadoStr())
			assert.Equal(t, int64(25000), proto.GetPrecio())
			assert.NotNil(t, proto.GetCreatedAt())
			assert.NotNil(t, proto.GetUpdatedAt())
		}
	})
}

func TestBuildListOrdersResponse(t *testing.T) {
	ordenes := []models.Orden{
		{IDOrden: 1, Estado: models.EstadoOrdenPendiente, Precio: 1000},
		{IDOrden: 2, Estado: models.EstadoOrdenAceptada, Precio: 2000},
	}

	t.Run("calculo correcto de total_pages y limites normalizados", func(t *testing.T) {
		resp := buildListOrdersResponse(ordenes, 25, 1, 10)
		require.NotNil(t, resp)
		assert.Len(t, resp.Orders, 2)
		assert.Equal(t, int64(25), resp.Meta.TotalRecords)
		assert.Equal(t, int32(1), resp.Meta.CurrentPage)
		assert.Equal(t, int32(10), resp.Meta.Limit)
		assert.Equal(t, int32(3), resp.Meta.TotalPages) // ceil(25/10) = 3
	})

	t.Run("limites extremos ajustados (page 0 y limit > 100)", func(t *testing.T) {
		resp := buildListOrdersResponse(nil, 0, 0, 200)
		require.NotNil(t, resp)
		assert.Empty(t, resp.Orders)
		assert.Equal(t, int32(1), resp.Meta.CurrentPage)
		assert.Equal(t, int32(100), resp.Meta.Limit)
		assert.Equal(t, int32(0), resp.Meta.TotalPages)
	})
}
