package orders

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/golang-jwt/jwt/v5"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
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
}

func TestHTTPGateway_ReachGRPC_Authenticated(t *testing.T) {
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

	t.Run("POST /v1/orders con token ejecuta validaciones de dominio gRPC (RN-21)", func(t *testing.T) {
		// Usuario comprador = 10 en token, enviamos id_usuario_vendedor = 10 -> falla RN-21
		body := strings.NewReader(`{"id_usuario_vendedor": 10, "id_publicacion": 5, "precio": 15000}`)
		req, err := http.NewRequest(http.MethodPost, httpServer.URL+"/v1/orders", body)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+tokenUser10)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		// gRPC InvalidArgument -> HTTP 400 Bad Request
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, string(respBytes), "RN-21")
	})

	t.Run("GET /v1/orders/{id} con token alcanza gRPC y retorna 501 Not Implemented", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, httpServer.URL+"/v1/orders/1", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+tokenUser10)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// gRPC Unimplemented -> HTTP 501 Not Implemented
		assert.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("GET /v1/orders/mis-compras con token autenticado atraviesa Gateway hasta servicio", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, httpServer.URL+"/v1/orders/mis-compras", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+tokenUser10)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Como s.db es nil, el servicio devuelve Unavailable (HTTP 503), confirmando que NO es 401 Unauthorized
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
	})
}
