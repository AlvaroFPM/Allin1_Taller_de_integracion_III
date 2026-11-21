package orders

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/golang-jwt/jwt/v5"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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

	// 1. Peticiones GET sin token -> interceptor gRPC devuelve 401 Unauthorized
	for _, ruta := range []string{
		"/v1/orders/mis-compras",
		"/v1/ordenes/mis-compras",
		"/v1/orders/mis-ventas",
		"/v1/ordenes/mis-ventas",
		"/v1/orders/1",
		"/v1/ordenes/1",
	} {
		resp, err := http.Get(httpServer.URL + ruta)
		require.NoError(t, err)
		resp.Body.Close()
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "ruta %s sin token debe retornar 401", ruta)
	}

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

	// Pruebas exhaustivas de compatibilidad de rutas y sus alias declarados en orders.proto (ALL-179 / ALL-149)
	t.Run("GET /v1/orders/{id} y alias /v1/ordenes/{id} validan ID y alcanzan GetOrder", func(t *testing.T) {
		for _, endpoint := range []string{"/v1/orders/0", "/v1/ordenes/0", "/v1/orders/abc", "/v1/ordenes/abc", "/v1/orders/-1"} {
			req, err := http.NewRequest(http.MethodGet, httpServer.URL+endpoint, nil)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			resp.Body.Close()
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "endpoint %s con ID inválido debe retornar 400", endpoint)
		}

		for _, endpoint := range []string{"/v1/orders/1", "/v1/ordenes/1"} {
			req, err := http.NewRequest(http.MethodGet, httpServer.URL+endpoint, nil)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+tokenUser10)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			resp.Body.Close()
			assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode, "endpoint %s con db == nil debe alcanzar el servicio y retornar 503", endpoint)
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

	// 5. Verificación de serialización de GetOrderResponse compatible con GetOrderResponseDto / OrderDto
	t.Run("GetOrderResponse serializa camelCase, precio int64 grande como string y timestamps RFC 3339", func(t *testing.T) {
		now := time.Date(2026, 11, 21, 18, 30, 0, 0, time.UTC)
		resp := &orderspb.GetOrderResponse{
			Order: &orderspb.Order{
				IdOrden:            77,
				IdUsuarioComprador: 501,
				IdUsuarioVendedor:  505,
				IdPublicacion:      702,
				Estado:             orderspb.EstadoOrden_ACEPTADA,
				EstadoStr:          "ACEPTADA",
				Precio:             9007199254740993,
				CreatedAt:          timestamppb.New(now),
				UpdatedAt:          timestamppb.New(now),
			},
		}

		jsonBytes, err := protojson.Marshal(resp)
		require.NoError(t, err)

		var rawMap map[string]interface{}
		require.NoError(t, json.Unmarshal(jsonBytes, &rawMap))

		orderMap, ok := rawMap["order"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, float64(77), orderMap["idOrden"])
		assert.Equal(t, float64(501), orderMap["idUsuarioComprador"])
		assert.Equal(t, float64(505), orderMap["idUsuarioVendedor"])
		assert.Equal(t, float64(702), orderMap["idPublicacion"])
		assert.Equal(t, "ACEPTADA", orderMap["estado"])
		assert.Equal(t, "ACEPTADA", orderMap["estadoStr"])
		assert.Equal(t, "9007199254740993", orderMap["precio"])
		assert.Equal(t, "2026-11-21T18:30:00Z", orderMap["createdAt"])
		assert.Equal(t, "2026-11-21T18:30:00Z", orderMap["updatedAt"])
	})

	// 6. Comportamiento de protojson en lista vacía compatible con useOrdersStore.ts (orders undefined -> [])
	t.Run("ListOrdersResponse vacia omite campos por defecto proto3 sin romper al consumidor", func(t *testing.T) {
		resp := &orderspb.ListOrdersResponse{
			Orders: []*orderspb.Order{},
			Meta: &orderspb.PaginationMeta{
				TotalRecords: 0,
				CurrentPage:  1,
				TotalPages:   0,
				Limit:        10,
			},
		}

		jsonBytes, err := protojson.Marshal(resp)
		require.NoError(t, err)

		var rawMap map[string]interface{}
		require.NoError(t, json.Unmarshal(jsonBytes, &rawMap))

		_, hasOrders := rawMap["orders"]
		assert.False(t, hasOrders, "protojson omite slice vacío por defecto; useOrdersStore aplica result.orders ?? []")
		metaMap, ok := rawMap["meta"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, float64(1), metaMap["currentPage"])
		assert.Equal(t, float64(10), metaMap["limit"])
		_, hasTotalRecords := metaMap["totalRecords"]
		assert.False(t, hasTotalRecords, "protojson omite int64 cero por defecto")
	})
}

func getOrdersRouterTestEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func setupOrdersRouterTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	host := getOrdersRouterTestEnv("DB_HOST", "localhost")
	port := getOrdersRouterTestEnv("DB_PORT", "5434")
	user := getOrdersRouterTestEnv("DB_USER", "catalog_user")
	password := getOrdersRouterTestEnv("DB_PASSWORD", "catalog_password")
	dbname := getOrdersRouterTestEnv("DB_NAME", "catalog_db")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("PostgreSQL local no disponible (%v). Levanta docker compose para correr tests de BD.", err)
	}

	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	require.NoError(t, db.AutoMigrate(&models.Orden{}))

	tx := db.Begin()
	require.NoError(t, tx.Error)
	t.Cleanup(func() {
		tx.Rollback()
	})

	return tx
}

func doAuthGet(t *testing.T, url, token string) (int, []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, body
}

func TestHTTPGateway_OrdersQueries_DBIntegration(t *testing.T) {
	t.Setenv("JWT_SECRET", testJWTSecret)
	tx := setupOrdersRouterTestDB(t)

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)
	orderService := service.NewOrderService(tx)
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

	require.NoError(t, RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts))

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	grpcConn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	defer grpcConn.Close()
	grpcClient := orderspb.NewOrderServiceClient(grpcConn)

	// Sembrar órdenes reales en PostgreSQL dentro de la transacción de prueba
	baseTime := time.Now().UTC().Add(-2 * time.Hour)
	compraPendiente := models.Orden{
		IDUsuarioComprador: 501,
		IDUsuarioVendedor:  502,
		IDPublicacion:      701,
		Estado:             models.EstadoOrdenPendiente,
		Precio:             45000,
		CreatedAt:          baseTime,
		UpdatedAt:          baseTime,
	}
	compraAceptada := models.Orden{
		IDUsuarioComprador: 501,
		IDUsuarioVendedor:  505,
		IDPublicacion:      702,
		Estado:             models.EstadoOrdenAceptada,
		Precio:             9007199254740993,
		CreatedAt:          baseTime.Add(15 * time.Minute),
		UpdatedAt:          baseTime.Add(30 * time.Minute),
	}
	ventaCompletada := models.Orden{
		IDUsuarioComprador: 504,
		IDUsuarioVendedor:  501,
		IDPublicacion:      703,
		Estado:             models.EstadoOrdenCompletada,
		Precio:             60000,
		CreatedAt:          baseTime.Add(45 * time.Minute),
		UpdatedAt:          baseTime.Add(60 * time.Minute),
	}
	ordenBorrada := models.Orden{
		IDUsuarioComprador: 501,
		IDUsuarioVendedor:  502,
		IDPublicacion:      704,
		Estado:             models.EstadoOrdenPendiente,
		Precio:             12000,
	}

	require.NoError(t, tx.Create(&compraPendiente).Error)
	require.NoError(t, tx.Create(&compraAceptada).Error)
	require.NoError(t, tx.Create(&ventaCompletada).Error)
	require.NoError(t, tx.Create(&ordenBorrada).Error)
	require.NoError(t, tx.Delete(&ordenBorrada).Error)

	token501 := createTestJWT(t, 501) // Comprador en compraPendiente/compraAceptada, Vendedor en ventaCompletada
	token502 := createTestJWT(t, 502) // Vendedor en compraPendiente
	token503 := createTestJWT(t, 503) // Tercero ajeno sin órdenes
	token505 := createTestJWT(t, 505) // Vendedor en compraAceptada

	t.Run("HTTP GetOrder autoriza a comprador y vendedor y verifica contrato DTO", func(t *testing.T) {
		for _, tc := range []struct {
			nombre string
			ruta   string
			token  string
		}{
			{"comprador via /v1/orders", fmt.Sprintf("/v1/orders/%d", compraAceptada.IDOrden), token501},
			{"vendedor via alias /v1/ordenes", fmt.Sprintf("/v1/ordenes/%d", compraAceptada.IDOrden), token505},
		} {
			code, body := doAuthGet(t, httpServer.URL+tc.ruta, tc.token)
			require.Equal(t, http.StatusOK, code, "%s: %s", tc.nombre, string(body))

			var raw map[string]interface{}
			require.NoError(t, json.Unmarshal(body, &raw))
			orderObj, ok := raw["order"].(map[string]interface{})
			require.True(t, ok, "respuesta debe contener objeto order")
			assert.Equal(t, float64(compraAceptada.IDOrden), orderObj["idOrden"])
			assert.Equal(t, float64(501), orderObj["idUsuarioComprador"])
			assert.Equal(t, float64(505), orderObj["idUsuarioVendedor"])
			assert.Equal(t, float64(702), orderObj["idPublicacion"])
			assert.Equal(t, "ACEPTADA", orderObj["estado"])
			assert.Equal(t, "ACEPTADA", orderObj["estadoStr"])
			assert.Equal(t, "9007199254740993", orderObj["precio"])
			createdStr, ok := orderObj["createdAt"].(string)
			require.True(t, ok)
			_, err := time.Parse(time.RFC3339Nano, createdStr)
			assert.NoError(t, err)
			updatedStr, ok := orderObj["updatedAt"].(string)
			require.True(t, ok)
			_, err = time.Parse(time.RFC3339Nano, updatedStr)
			assert.NoError(t, err)

			if tc.nombre == "comprador via /v1/orders" {
				t.Logf("EVIDENCIA_JSON_GET_ORDER=%s", string(body))
			}
		}
	})

	t.Run("HTTP GetOrder rechaza tercero, inexistente, soft-delete, id invalido y sin token", func(t *testing.T) {
		casos := []struct {
			nombre   string
			ruta     string
			token    string
			wantCode int
		}{
			{"tercero ajeno recibe 403", fmt.Sprintf("/v1/orders/%d", compraAceptada.IDOrden), token503, http.StatusForbidden},
			{"inexistente recibe 404", "/v1/orders/9999999", token501, http.StatusNotFound},
			{"soft-delete recibe 404", fmt.Sprintf("/v1/orders/%d", ordenBorrada.IDOrden), token501, http.StatusNotFound},
			{"id cero recibe 400", "/v1/orders/0", token501, http.StatusBadRequest},
			{"id no numerico recibe 400", "/v1/ordenes/abc", token501, http.StatusBadRequest},
			{"sin token recibe 401", fmt.Sprintf("/v1/orders/%d", compraAceptada.IDOrden), "", http.StatusUnauthorized},
		}

		for _, tc := range casos {
			code, body := doAuthGet(t, httpServer.URL+tc.ruta, tc.token)
			assert.Equal(t, tc.wantCode, code, "%s: body=%s", tc.nombre, string(body))
			t.Logf("EVIDENCIA_ERROR_%d (%s)=%s", code, tc.nombre, string(body))
		}
	})

	t.Run("HTTP ListMyPurchases y ListMySales aislan roles, filtran y paginan", func(t *testing.T) {
		// Compras completas de 501
		code, bodyPurchases := doAuthGet(t, httpServer.URL+"/v1/orders/mis-compras?page=1&limit=10", token501)
		require.Equal(t, http.StatusOK, code, string(bodyPurchases))
		t.Logf("EVIDENCIA_JSON_LIST_PURCHASES=%s", string(bodyPurchases))

		var respPurchases orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodyPurchases, &respPurchases))
		require.Len(t, respPurchases.GetOrders(), 2)
		assert.Equal(t, uint32(compraAceptada.IDOrden), respPurchases.GetOrders()[0].GetIdOrden())
		assert.Equal(t, uint32(compraPendiente.IDOrden), respPurchases.GetOrders()[1].GetIdOrden())
		assert.Equal(t, int64(2), respPurchases.GetMeta().GetTotalRecords())
		assert.Equal(t, int32(1), respPurchases.GetMeta().GetCurrentPage())
		assert.Equal(t, int32(1), respPurchases.GetMeta().GetTotalPages())
		assert.Equal(t, int32(10), respPurchases.GetMeta().GetLimit())

		// Filtro por estado PENDIENTE
		code, bodyFiltered := doAuthGet(t, httpServer.URL+"/v1/ordenes/mis-compras?page=1&limit=10&estado=PENDIENTE", token501)
		require.Equal(t, http.StatusOK, code, string(bodyFiltered))
		var respFiltered orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodyFiltered, &respFiltered))
		require.Len(t, respFiltered.GetOrders(), 1)
		assert.Equal(t, uint32(compraPendiente.IDOrden), respFiltered.GetOrders()[0].GetIdOrden())
		assert.Equal(t, int64(1), respFiltered.GetMeta().GetTotalRecords())

		// Paginación page=2&limit=1
		code, bodyPage2 := doAuthGet(t, httpServer.URL+"/v1/orders/mis-compras?page=2&limit=1", token501)
		require.Equal(t, http.StatusOK, code, string(bodyPage2))
		var respPage2 orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodyPage2, &respPage2))
		require.Len(t, respPage2.GetOrders(), 1)
		assert.Equal(t, uint32(compraPendiente.IDOrden), respPage2.GetOrders()[0].GetIdOrden())
		assert.Equal(t, int32(2), respPage2.GetMeta().GetCurrentPage())
		assert.Equal(t, int32(2), respPage2.GetMeta().GetTotalPages())

		// Filtro inválido retorna 400
		code, _ = doAuthGet(t, httpServer.URL+"/v1/orders/mis-compras?estado=INVALIDO", token501)
		assert.Equal(t, http.StatusBadRequest, code)

		// Ventas de 501 (solo ventaCompletada)
		code, bodySales501 := doAuthGet(t, httpServer.URL+"/v1/orders/mis-ventas?page=1&limit=10", token501)
		require.Equal(t, http.StatusOK, code, string(bodySales501))
		t.Logf("EVIDENCIA_JSON_LIST_SALES=%s", string(bodySales501))

		var respSales501 orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodySales501, &respSales501))
		require.Len(t, respSales501.GetOrders(), 1)
		assert.Equal(t, uint32(ventaCompletada.IDOrden), respSales501.GetOrders()[0].GetIdOrden())
		assert.Equal(t, uint32(501), respSales501.GetOrders()[0].GetIdUsuarioVendedor())
		assert.Equal(t, int64(1), respSales501.GetMeta().GetTotalRecords())

		// Ventas de 502 via alias (solo compraPendiente; ordenBorrada queda excluida)
		code, bodySales502 := doAuthGet(t, httpServer.URL+"/v1/ordenes/mis-ventas?page=1&limit=10", token502)
		require.Equal(t, http.StatusOK, code, string(bodySales502))
		var respSales502 orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodySales502, &respSales502))
		require.Len(t, respSales502.GetOrders(), 1)
		assert.Equal(t, uint32(compraPendiente.IDOrden), respSales502.GetOrders()[0].GetIdOrden())

		// Usuario sin órdenes (503) retorna 200 OK sin órdenes
		code, bodyEmpty := doAuthGet(t, httpServer.URL+"/v1/orders/mis-compras?page=1&limit=10", token503)
		require.Equal(t, http.StatusOK, code, string(bodyEmpty))
		t.Logf("EVIDENCIA_JSON_LIST_EMPTY=%s", string(bodyEmpty))
		var respEmpty orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodyEmpty, &respEmpty))
		assert.Empty(t, respEmpty.GetOrders())
		assert.Equal(t, int64(0), respEmpty.GetMeta().GetTotalRecords())
	})

	t.Run("gRPC nativo GetOrder y listados respetan autenticacion, autorizacion y contrato", func(t *testing.T) {
		ctx501 := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token501)
		ctx505 := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token505)
		ctx503 := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token503)

		// Comprador y vendedor obtienen la orden real
		respBuyer, err := grpcClient.GetOrder(ctx501, &orderspb.GetOrderRequest{IdOrden: uint32(compraAceptada.IDOrden)})
		require.NoError(t, err)
		assert.Equal(t, int64(9007199254740993), respBuyer.GetOrder().GetPrecio())
		assert.NotNil(t, respBuyer.GetOrder().GetCreatedAt())

		respSeller, err := grpcClient.GetOrder(ctx505, &orderspb.GetOrderRequest{IdOrden: uint32(compraAceptada.IDOrden)})
		require.NoError(t, err)
		assert.Equal(t, uint32(compraAceptada.IDOrden), respSeller.GetOrder().GetIdOrden())

		// Tercero, inexistente, inválido y sin token
		_, err = grpcClient.GetOrder(ctx503, &orderspb.GetOrderRequest{IdOrden: uint32(compraAceptada.IDOrden)})
		assert.Equal(t, codes.PermissionDenied, status.Code(err))

		_, err = grpcClient.GetOrder(ctx501, &orderspb.GetOrderRequest{IdOrden: 9999999})
		assert.Equal(t, codes.NotFound, status.Code(err))

		_, err = grpcClient.GetOrder(ctx501, &orderspb.GetOrderRequest{IdOrden: 0})
		assert.Equal(t, codes.InvalidArgument, status.Code(err))

		_, err = grpcClient.GetOrder(ctx, &orderspb.GetOrderRequest{IdOrden: uint32(compraAceptada.IDOrden)})
		assert.Equal(t, codes.Unauthenticated, status.Code(err))

		// Listados gRPC nativos
		purchases, err := grpcClient.ListMyPurchases(ctx501, &orderspb.ListMyPurchasesRequest{Page: 1, Limit: 10})
		require.NoError(t, err)
		assert.Len(t, purchases.GetOrders(), 2)
		assert.Equal(t, int64(2), purchases.GetMeta().GetTotalRecords())

		sales, err := grpcClient.ListMySales(ctx501, &orderspb.ListMySalesRequest{Page: 1, Limit: 10})
		require.NoError(t, err)
		assert.Len(t, sales.GetOrders(), 1)
		assert.Equal(t, int64(1), sales.GetMeta().GetTotalRecords())
	})
}
