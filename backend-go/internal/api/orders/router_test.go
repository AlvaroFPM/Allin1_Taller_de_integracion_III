package orders

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/golang-jwt/jwt/v5"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const testJWTSecret = "super-secret-key-development-only"

func createTestJWT(t *testing.T, userID float64) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	signed, err := tok.SignedString([]byte(testJWTSecret))
	require.NoError(t, err)
	return signed
}

func TestRegisterGRPCRouter(t *testing.T) {
	grpcServer := grpc.NewServer()
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)

	assert.NotPanics(t, func() {
		RegisterGRPCRouter(grpcServer, orderServer)
	})

	services := grpcServer.GetServiceInfo()
	assert.Contains(t, services, "orders.OrderService")
	assert.Contains(t, services, "grpc.reflection.v1alpha.ServerReflection")
}

func TestRegisterGatewayRouter(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer()
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx := context.Background()
	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	assert.NoError(t, err)
}

func TestHTTPGateway_ReachGRPC_Unauthenticated(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	require.NoError(t, err)

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	// 1. Petición GET sin token a /v1/orders/mis-compras -> interceptor gRPC devuelve 401 Unauthorized
	resp, err := http.Get(httpServer.URL + "/v1/orders/mis-compras")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

	// 2. Petición POST sin token a /v1/orders -> interceptor gRPC devuelve 401 Unauthorized
	body := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 5, "precio": 10000}`)
	respPost, err := http.Post(httpServer.URL+"/v1/orders", "application/json", body)
	require.NoError(t, err)
	defer respPost.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, respPost.StatusCode)

	// 3. Petición POST sin token al alias /v1/ordenes -> interceptor gRPC devuelve 401 Unauthorized
	bodyAlias := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 5, "precio": 10000}`)
	respAlias, err := http.Post(httpServer.URL+"/v1/ordenes", "application/json", bodyAlias)
	require.NoError(t, err)
	defer respAlias.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, respAlias.StatusCode)
}

func TestHTTPGateway_CreateOrder_DefaultDisabled(t *testing.T) {
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("ORDERS_ENABLE_CREATION", "")

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	require.NoError(t, err)

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	tokenUser10 := createTestJWT(t, 10)

	rutas := []string{"/v1/orders", "/v1/ordenes"}
	for _, ruta := range rutas {
		t.Run("Ruta "+ruta+" deshabilitada por defecto retorna 501", func(t *testing.T) {
			body := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 5, "precio": 15000}`)
			req, err := http.NewRequest(http.MethodPost, httpServer.URL+ruta, body)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			respBytes, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusNotImplemented, resp.StatusCode)
			assert.Contains(t, string(respBytes), "ALL-141")
		})
	}
}

func TestHTTPGateway_CreateOrder_EndpointsAndAlias(t *testing.T) {
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("ORDERS_ENABLE_CREATION", "true")

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	require.NoError(t, err)

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	tokenUser10 := createTestJWT(t, 10)

	// Criterio de aceptación 1: POST /v1/orders y su alias declarado llegan a la misma lógica
	rutas := []string{"/v1/orders", "/v1/ordenes"}

	for _, ruta := range rutas {
		t.Run("Ruta "+ruta+" rechaza comprador==vendedor (RN-21)", func(t *testing.T) {
			// Comprador autenticado = 10, enviamos id_usuario_vendedor = 10 -> falla RN-21
			body := strings.NewReader(`{"id_usuario_vendedor": 10, "id_publicacion": 5, "precio": 15000}`)
			req, err := http.NewRequest(http.MethodPost, httpServer.URL+ruta, body)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			respBytes, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			assert.Contains(t, string(respBytes), "RN-21")
		})

		t.Run("Ruta "+ruta+" rechaza precio menor o igual a cero (RN-23)", func(t *testing.T) {
			body := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 5, "precio": 0}`)
			req, err := http.NewRequest(http.MethodPost, httpServer.URL+ruta, body)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			respBytes, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			assert.Contains(t, string(respBytes), "RN-23")
		})

		t.Run("Ruta "+ruta+" rechaza publicacion en cero", func(t *testing.T) {
			body := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 0, "precio": 15000}`)
			req, err := http.NewRequest(http.MethodPost, httpServer.URL+ruta, body)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			respBytes, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			assert.Contains(t, string(respBytes), "el id de la publicación es obligatorio")
		})

		t.Run("Ruta "+ruta+" con datos validos supera autenticacion y validaciones", func(t *testing.T) {
			body := strings.NewReader(`{"id_usuario_vendedor": 2, "id_publicacion": 5, "precio": 15000}`)
			req, err := http.NewRequest(http.MethodPost, httpServer.URL+ruta, body)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			// Como el servicio no tiene BD activa en test unitario puro (db == nil),
			// responde 503 Service Unavailable confirmando que atravesó el Gateway,
			// superó la autenticación JWT y pasó todas las validaciones de negocio en OrderService.
			assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		})
	}
}

func TestHTTPGateway_OtherEndpoints(t *testing.T) {
	t.Setenv("JWT_SECRET", testJWTSecret)

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)
	orderService := service.NewOrderService(nil)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	require.NoError(t, err)

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	tokenUser10 := createTestJWT(t, 10)

	// Pruebas exhaustivas de compatibilidad de rutas y sus alias declarados en orders.proto (ALL-179)
	t.Run("GET /v1/orders/{id} y alias /v1/ordenes/{id} retornan 501 Not Implemented (ALL-149)", func(t *testing.T) {
		for _, endpoint := range []string{"/v1/orders/1", "/v1/ordenes/1"} {
			req, err := http.NewRequest(http.MethodGet, httpServer.URL+endpoint, nil)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			respBytes, _ := io.ReadAll(resp.Body)
			assert.Equal(t, http.StatusNotImplemented, resp.StatusCode, "endpoint %s debe retornar 501", endpoint)
			assert.Contains(t, string(respBytes), "ALL-149")
		}
	})

	t.Run("PATCH /v1/orders/{id} y alias /v1/ordenes/{id} admiten snake_case y camelCase", func(t *testing.T) {
		casos := []struct {
			endpoint string
			body     string
		}{
			{"/v1/orders/1", `{"nuevo_estado": "ACEPTADA"}`},
			{"/v1/orders/1", `{"nuevoEstado": "ACEPTADA"}`},
			{"/v1/ordenes/1", `{"nuevo_estado": "ACEPTADA"}`},
			{"/v1/ordenes/1", `{"nuevoEstado": "ACEPTADA"}`},
		}

		for _, tc := range casos {
			req, err := http.NewRequest(http.MethodPatch, httpServer.URL+tc.endpoint, strings.NewReader(tc.body))
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			// Con db == nil alcanza el servicio y retorna 503 indicando transporte correcto
			assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		}
	})

	t.Run("GET mis-compras y mis-ventas con rutas principales y alias", func(t *testing.T) {
		rutas := []string{
			"/v1/orders/mis-compras?page=1&limit=10&estado=PENDIENTE",
			"/v1/ordenes/mis-compras?page=1&limit=10&estado=PENDIENTE",
			"/v1/orders/mis-ventas?page=1&limit=10&estado=PENDIENTE",
			"/v1/ordenes/mis-ventas?page=1&limit=10&estado=PENDIENTE",
		}

		for _, ruta := range rutas {
			req, err := http.NewRequest(http.MethodGet, httpServer.URL+ruta, nil)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode, "ruta %s debe alcanzar el servicio", ruta)
		}
	})
}

func TestProtoJSON_FrontendCompatibility(t *testing.T) {
	// 1. Verificación de deserialización JSON de CreateOrderRequest compatible con Frontend (CreateOrderRequestDto)
	t.Run("CreateOrderRequest deserializa camelCase y tipos string/int64 enviados por Frontend", func(t *testing.T) {
		// El frontend (orderService.ts) envía precio como string y campos en camelCase
		jsonPayload := `{"idUsuarioVendedor": 3, "idPublicacion": 15, "precio": "25000"}`
		var req orderspb.CreateOrderRequest
		err := protojson.Unmarshal([]byte(jsonPayload), &req)
		require.NoError(t, err)

		assert.Equal(t, uint32(3), req.GetIdUsuarioVendedor())
		assert.Equal(t, uint32(15), req.GetIdPublicacion())
		assert.Equal(t, int64(25000), req.GetPrecio())

		// También acepta número entero puro si algún consumidor lo envía directamente
		jsonNumPayload := `{"idUsuarioVendedor": 3, "idPublicacion": 15, "precio": 25000}`
		var reqNum orderspb.CreateOrderRequest
		err = protojson.Unmarshal([]byte(jsonNumPayload), &reqNum)
		require.NoError(t, err)
		assert.Equal(t, int64(25000), reqNum.GetPrecio())
	})

	// 2. Verificación de serialización JSON de CreateOrderResponse compatible con Frontend (OrderDto / CreateOrderResponseDto)
	t.Run("CreateOrderResponse serializa camelCase y precio string int64 para el Frontend", func(t *testing.T) {
		now := time.Date(2026, 11, 15, 20, 0, 0, 0, time.UTC)
		resp := &orderspb.CreateOrderResponse{
			Order: &orderspb.Order{
				IdOrden:            101,
				IdUsuarioComprador: 7,
				IdUsuarioVendedor:  3,
				IdPublicacion:      15,
				Estado:             orderspb.EstadoOrden_PENDIENTE,
				EstadoStr:          "PENDIENTE",
				Precio:             25000,
				CreatedAt:          timestamppb.New(now),
				UpdatedAt:          timestamppb.New(now),
			},
			Message: "Orden creada exitosamente",
		}

		jsonBytes, err := protojson.Marshal(resp)
		require.NoError(t, err)

		// Parsear a mapa genérico para verificar las claves JSON que consume el frontend
		var rawMap map[string]interface{}
		err = json.Unmarshal(jsonBytes, &rawMap)
		require.NoError(t, err)

		assert.Equal(t, "Orden creada exitosamente", rawMap["message"])

		orderMap, ok := rawMap["order"].(map[string]interface{})
		require.True(t, ok, "el objeto order debe estar presente")

		// Comprobar nombres camelCase consumidos por order.ts y ordenes-dashboard
		assert.Equal(t, float64(101), orderMap["idOrden"])
		assert.Equal(t, float64(7), orderMap["idUsuarioComprador"])
		assert.Equal(t, float64(3), orderMap["idUsuarioVendedor"])
		assert.Equal(t, float64(15), orderMap["idPublicacion"])
		assert.Equal(t, "PENDIENTE", orderMap["estado"])
		assert.Equal(t, "PENDIENTE", orderMap["estadoStr"])
		// int64 se serializa como string en protojson para preservar precisión en JavaScript
		assert.Equal(t, "25000", orderMap["precio"])
		assert.NotEmpty(t, orderMap["createdAt"])
		assert.NotEmpty(t, orderMap["updatedAt"])
	})

	// 3. Verificación de deserialización de PatchOrderStatusRequest (ordersMutationService.ts)
	t.Run("PatchOrderStatusRequest deserializa camelCase nuevoEstado", func(t *testing.T) {
		jsonPayload := `{"nuevoEstado": "ACEPTADA"}`
		var req orderspb.PatchOrderStatusRequest
		err := protojson.Unmarshal([]byte(jsonPayload), &req)
		require.NoError(t, err)
		assert.Equal(t, "ACEPTADA", req.GetNuevoEstado())
	})

	// 4. Verificación de serialización de ListOrdersResponse (useOrdersStore.ts y ordersQueryService.ts)
	t.Run("ListOrdersResponse serializa array de orders y meta con totalRecords string", func(t *testing.T) {
		resp := &orderspb.ListOrdersResponse{
			Orders: []*orderspb.Order{
				{
					IdOrden:   1,
					Estado:    orderspb.EstadoOrden_PENDIENTE,
					EstadoStr: "PENDIENTE",
					Precio:    10000,
				},
			},
			Meta: &orderspb.PaginationMeta{
				TotalRecords: 1,
				CurrentPage:  1,
				TotalPages:   1,
				Limit:        10,
			},
		}

		jsonBytes, err := protojson.Marshal(resp)
		require.NoError(t, err)

		var rawMap map[string]interface{}
		err = json.Unmarshal(jsonBytes, &rawMap)
		require.NoError(t, err)

		metaMap, ok := rawMap["meta"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "1", metaMap["totalRecords"]) // string por int64
		assert.Equal(t, float64(1), metaMap["currentPage"])
		assert.Equal(t, float64(1), metaMap["totalPages"])
		assert.Equal(t, float64(10), metaMap["limit"])
	})
}
