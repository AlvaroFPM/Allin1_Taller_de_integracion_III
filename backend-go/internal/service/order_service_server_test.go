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

func TestOrderServiceServer_InterfaceCompliance(t *testing.T) {
	// Verificación en tiempo de compilación y ejecución de que OrderServiceServer
	// implementa completamente la interfaz orderspb.OrderServiceServer generada por Protobuf (ALL-179)
	var serverInterface orderspb.OrderServiceServer = (*OrderServiceServer)(nil)
	assert.Nil(t, serverInterface)

	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)
	require.NotNil(t, server)

	serverInterface = server
	assert.NotNil(t, serverInterface)
}

func TestOrderServiceServer_CreateOrder_DefaultDisabled(t *testing.T) {
	t.Setenv("ORDERS_ENABLE_CREATION", "")
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	ctx := authenticatedContext(1)
	req := &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 2,
		IdPublicacion:     10,
		Precio:            15000,
	}

	resp, err := server.CreateOrder(ctx, req)
	require.Error(t, err)
	assert.Nil(t, resp)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
	assert.Contains(t, err.Error(), "ALL-141")
}

func TestOrderServiceServer_CreateOrder_Validations(t *testing.T) {
	t.Setenv("ORDERS_ENABLE_CREATION", "true")
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	t.Run("nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.CreateOrder(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), "la solicitud de creación es requerida")
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
		assert.Contains(t, err.Error(), "usuario no autenticado")
	})

	t.Run("comprador igual a vendedor (RN-21 auto-compra) retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(5)
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 5, // mismo ID que comprador autenticado
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

	t.Run("vendedorID cero retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(1)
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 0,
			IdPublicacion:     10,
			Precio:            15000,
		}
		resp, err := server.CreateOrder(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), "el id del vendedor es obligatorio")
	})

	t.Run("publicacionID cero retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(1)
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 2,
			IdPublicacion:     0,
			Precio:            15000,
		}
		resp, err := server.CreateOrder(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), "el id de la publicación es obligatorio")
	})
}

func TestOrderServiceServer_CreateOrder_DBIntegration(t *testing.T) {
	t.Setenv("ORDERS_ENABLE_CREATION", "true")
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx, newCatalogStub(activePub(10, 3, 25000)))
	server := NewOrderServiceServer(svc)

	ctx := authenticatedContext(7) // Comprador autenticado: ID 7

	t.Run("creacion exitosa vincula comprador autenticado y persiste en BD", func(t *testing.T) {
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 3,
			IdPublicacion:     10,
			Precio:            25000,
		}

		resp, err := server.CreateOrder(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, resp.Order)

		// Coincidencia estricta de comprador con el token
		assert.Equal(t, uint32(7), resp.Order.GetIdUsuarioComprador())
		assert.Equal(t, uint32(3), resp.Order.GetIdUsuarioVendedor())
		assert.Equal(t, uint32(10), resp.Order.GetIdPublicacion())
		assert.Equal(t, int64(25000), resp.Order.GetPrecio())
		assert.Equal(t, orderspb.EstadoOrden_PENDIENTE, resp.Order.GetEstado())
		assert.Equal(t, models.EstadoOrdenPendiente, resp.Order.GetEstadoStr())
		assert.NotZero(t, resp.Order.GetIdOrden())
		assert.Contains(t, resp.GetMessage(), "exitosamente")

		// Verificar que la orden realmente existe en la BD
		var enBD models.Orden
		err = tx.First(&enBD, resp.Order.GetIdOrden()).Error
		require.NoError(t, err)
		assert.Equal(t, uint(7), enBD.IDUsuarioComprador)
		assert.Equal(t, uint(3), enBD.IDUsuarioVendedor)
		assert.Equal(t, uint(10), enBD.IDPublicacion)
		assert.Equal(t, int64(25000), enBD.Precio)
		assert.Equal(t, models.EstadoOrdenPendiente, enBD.Estado)
	})

	t.Run("rechazo de orden activa duplicada (RN-22)", func(t *testing.T) {
		req := &orderspb.CreateOrderRequest{
			IdUsuarioVendedor: 3,
			IdPublicacion:     10,
			Precio:            25000,
		}

		// Segunda llamada para la misma publicación estando en PENDIENTE
		resp, err := server.CreateOrder(ctx, req)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.AlreadyExists, status.Code(err))
		assert.Contains(t, err.Error(), "RN-22")
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

func TestOrderServiceServer_GetOrder_Validations(t *testing.T) {
	svc := NewOrderService(nil)
	server := NewOrderServiceServer(svc)

	t.Run("nil request retorna InvalidArgument", func(t *testing.T) {
		resp, err := server.GetOrder(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("sin usuario autenticado retorna Unauthenticated", func(t *testing.T) {
		resp, err := server.GetOrder(context.Background(), &orderspb.GetOrderRequest{IdOrden: 1})
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("id_orden en cero retorna InvalidArgument", func(t *testing.T) {
		ctx := authenticatedContext(10)
		resp, err := server.GetOrder(ctx, &orderspb.GetOrderRequest{IdOrden: 0})
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("db nil con id valido retorna Unavailable", func(t *testing.T) {
		ctx := authenticatedContext(10)
		resp, err := server.GetOrder(ctx, &orderspb.GetOrderRequest{IdOrden: 1})
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, codes.Unavailable, status.Code(err))
	})
}

func TestOrderServiceServer_GetOrder_DBIntegration(t *testing.T) {
	t.Setenv("ORDERS_ENABLE_CREATION", "true")
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx, newCatalogStub(
		activePub(80, 21, 9007199254740993),
		activePub(81, 21, 12000),
	))
	server := NewOrderServiceServer(svc)

	ctxComprador := authenticatedContext(11)
	ctxVendedor := authenticatedContext(21)
	ctxTercero := authenticatedContext(31)

	creada, err := server.CreateOrder(ctxComprador, &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 21,
		IdPublicacion:     80,
		Precio:            9007199254740993,
	})
	require.NoError(t, err)
	ordenID := creada.GetOrder().GetIdOrden()

	// Orden con soft-delete no debe ser accesible
	borrada, err := server.CreateOrder(ctxComprador, &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 21,
		IdPublicacion:     81,
		Precio:            12000,
	})
	require.NoError(t, err)
	require.NoError(t, tx.Delete(&models.Orden{}, borrada.GetOrder().GetIdOrden()).Error)

	t.Run("comprador obtiene detalle completo mapeado a protobuf", func(t *testing.T) {
		resp, err := server.GetOrder(ctxComprador, &orderspb.GetOrderRequest{IdOrden: ordenID})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, resp.GetOrder())
		assert.Equal(t, ordenID, resp.GetOrder().GetIdOrden())
		assert.Equal(t, uint32(11), resp.GetOrder().GetIdUsuarioComprador())
		assert.Equal(t, uint32(21), resp.GetOrder().GetIdUsuarioVendedor())
		assert.Equal(t, uint32(80), resp.GetOrder().GetIdPublicacion())
		assert.Equal(t, orderspb.EstadoOrden_PENDIENTE, resp.GetOrder().GetEstado())
		assert.Equal(t, models.EstadoOrdenPendiente, resp.GetOrder().GetEstadoStr())
		assert.Equal(t, int64(9007199254740993), resp.GetOrder().GetPrecio())
		require.NotNil(t, resp.GetOrder().GetCreatedAt())
		require.NotNil(t, resp.GetOrder().GetUpdatedAt())
		assert.True(t, resp.GetOrder().GetCreatedAt().IsValid())
		assert.True(t, resp.GetOrder().GetUpdatedAt().IsValid())
	})

	t.Run("vendedor obtiene el mismo detalle", func(t *testing.T) {
		resp, err := server.GetOrder(ctxVendedor, &orderspb.GetOrderRequest{IdOrden: ordenID})
		require.NoError(t, err)
		require.NotNil(t, resp.GetOrder())
		assert.Equal(t, ordenID, resp.GetOrder().GetIdOrden())
		assert.Equal(t, int64(9007199254740993), resp.GetOrder().GetPrecio())
	})

	t.Run("cuenta ajena es rechazada con PermissionDenied", func(t *testing.T) {
		resp, err := server.GetOrder(ctxTercero, &orderspb.GetOrderRequest{IdOrden: ordenID})
		assert.Nil(t, resp)
		require.Error(t, err)
		assert.Equal(t, codes.PermissionDenied, status.Code(err))
	})

	t.Run("recurso inexistente es rechazado con NotFound", func(t *testing.T) {
		resp, err := server.GetOrder(ctxComprador, &orderspb.GetOrderRequest{IdOrden: 9999999})
		assert.Nil(t, resp)
		require.Error(t, err)
		assert.Equal(t, codes.NotFound, status.Code(err))
	})

	t.Run("orden eliminada (soft-delete) es rechazada con NotFound", func(t *testing.T) {
		resp, err := server.GetOrder(ctxComprador, &orderspb.GetOrderRequest{IdOrden: borrada.GetOrder().GetIdOrden()})
		assert.Nil(t, resp)
		require.Error(t, err)
		assert.Equal(t, codes.NotFound, status.Code(err))
	})
}

func TestOrderServiceServer_ListOrders_DBIntegration(t *testing.T) {
	t.Setenv("ORDERS_ENABLE_CREATION", "true")
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx, newCatalogStub(
		activePub(91, 202, 10000),
		activePub(92, 203, 20000),
		activePub(93, 101, 30000),
	))
	server := NewOrderServiceServer(svc)

	ctx101 := authenticatedContext(101)
	ctx202 := authenticatedContext(202)
	ctx204 := authenticatedContext(204)
	ctxSinOrdenes := authenticatedContext(999999)

	// Usuario 101 es comprador en oCompra1 (PENDIENTE) y oCompra2 (ACEPTADA)
	oCompra1, err := server.CreateOrder(ctx101, &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 202,
		IdPublicacion:     91,
		Precio:            10000,
	})
	require.NoError(t, err)

	oCompra2, err := server.CreateOrder(ctx101, &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 203,
		IdPublicacion:     92,
		Precio:            20000,
	})
	require.NoError(t, err)
	_, err = server.PatchOrderStatus(authenticatedContext(203), &orderspb.PatchOrderStatusRequest{
		IdOrden:     oCompra2.GetOrder().GetIdOrden(),
		NuevoEstado: models.EstadoOrdenAceptada,
	})
	require.NoError(t, err)

	// Usuario 101 es vendedor en oVenta (comprador 204)
	oVenta, err := server.CreateOrder(ctx204, &orderspb.CreateOrderRequest{
		IdUsuarioVendedor: 101,
		IdPublicacion:     93,
		Precio:            30000,
	})
	require.NoError(t, err)

	t.Run("ListMyPurchases retorna solo compras del usuario con PaginationMeta real", func(t *testing.T) {
		resp, err := server.ListMyPurchases(ctx101, &orderspb.ListMyPurchasesRequest{Page: 1, Limit: 1})
		require.NoError(t, err)
		require.Len(t, resp.GetOrders(), 1)
		assert.Equal(t, oCompra2.GetOrder().GetIdOrden(), resp.GetOrders()[0].GetIdOrden())
		assert.Equal(t, uint32(101), resp.GetOrders()[0].GetIdUsuarioComprador())
		require.NotNil(t, resp.GetMeta())
		assert.Equal(t, int64(2), resp.GetMeta().GetTotalRecords())
		assert.Equal(t, int32(1), resp.GetMeta().GetCurrentPage())
		assert.Equal(t, int32(2), resp.GetMeta().GetTotalPages())
		assert.Equal(t, int32(1), resp.GetMeta().GetLimit())

		// Página 2
		respP2, err := server.ListMyPurchases(ctx101, &orderspb.ListMyPurchasesRequest{Page: 2, Limit: 1})
		require.NoError(t, err)
		require.Len(t, respP2.GetOrders(), 1)
		assert.Equal(t, oCompra1.GetOrder().GetIdOrden(), respP2.GetOrders()[0].GetIdOrden())
		assert.Equal(t, int32(2), respP2.GetMeta().GetCurrentPage())
	})

	t.Run("ListMyPurchases filtra por estado y actualiza metadatos", func(t *testing.T) {
		estado := models.EstadoOrdenAceptada
		resp, err := server.ListMyPurchases(ctx101, &orderspb.ListMyPurchasesRequest{
			Page:   1,
			Limit:  10,
			Estado: &estado,
		})
		require.NoError(t, err)
		require.Len(t, resp.GetOrders(), 1)
		assert.Equal(t, oCompra2.GetOrder().GetIdOrden(), resp.GetOrders()[0].GetIdOrden())
		assert.Equal(t, orderspb.EstadoOrden_ACEPTADA, resp.GetOrders()[0].GetEstado())
		assert.Equal(t, int64(1), resp.GetMeta().GetTotalRecords())
		assert.Equal(t, int32(1), resp.GetMeta().GetTotalPages())
	})

	t.Run("ListMySales retorna solo ventas del usuario y aisla otros vendedores", func(t *testing.T) {
		resp101, err := server.ListMySales(ctx101, &orderspb.ListMySalesRequest{Page: 1, Limit: 10})
		require.NoError(t, err)
		require.Len(t, resp101.GetOrders(), 1)
		assert.Equal(t, oVenta.GetOrder().GetIdOrden(), resp101.GetOrders()[0].GetIdOrden())
		assert.Equal(t, uint32(101), resp101.GetOrders()[0].GetIdUsuarioVendedor())
		assert.Equal(t, int64(1), resp101.GetMeta().GetTotalRecords())

		resp202, err := server.ListMySales(ctx202, &orderspb.ListMySalesRequest{Page: 1, Limit: 10})
		require.NoError(t, err)
		require.Len(t, resp202.GetOrders(), 1)
		assert.Equal(t, oCompra1.GetOrder().GetIdOrden(), resp202.GetOrders()[0].GetIdOrden())
		assert.Equal(t, uint32(202), resp202.GetOrders()[0].GetIdUsuarioVendedor())
	})

	t.Run("usuario sin ordenes obtiene lista vacia y meta consistente", func(t *testing.T) {
		resp, err := server.ListMyPurchases(ctxSinOrdenes, &orderspb.ListMyPurchasesRequest{Page: 1, Limit: 10})
		require.NoError(t, err)
		assert.Empty(t, resp.GetOrders())
		require.NotNil(t, resp.GetMeta())
		assert.Equal(t, int64(0), resp.GetMeta().GetTotalRecords())
		assert.Equal(t, int32(1), resp.GetMeta().GetCurrentPage())
		assert.Equal(t, int32(0), resp.GetMeta().GetTotalPages())
		assert.Equal(t, int32(10), resp.GetMeta().GetLimit())
	})
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
