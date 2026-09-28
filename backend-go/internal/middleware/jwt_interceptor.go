package middleware

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// UnaryAuthInterceptor intercepta peticiones gRPC para verificar el JWT
func UnaryAuthInterceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		// Rutas públicas que no requieren autenticación
		publicRoutes := map[string]bool{
			"/auth.AuthService/Login":    true,
			"/auth.AuthService/Register": true,
		}

		if publicRoutes[info.FullMethod] {
			return handler(ctx, req)
		}

		// Extraer metadata del contexto (grpc-gateway pasa los headers HTTP aquí)
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "metadata no proporcionada")
		}

		// El header "Authorization" se convierte a minúsculas en gRPC metadata
		values := md["authorization"]
		if len(values) == 0 {
			// Intentar con "grpcgateway-authorization" por si acaso
			values = md["grpcgateway-authorization"]
			if len(values) == 0 {
				return nil, status.Errorf(codes.Unauthenticated, "token de autorización no proporcionado")
			}
		}

		authHeader := values[0]
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return nil, status.Errorf(codes.Unauthenticated, "formato de token inválido")
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		secretKey := os.Getenv("JWT_SECRET")
		if secretKey == "" {
			secretKey = "super-secret-key-development-only"
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de firma inesperado")
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			return nil, status.Errorf(codes.Unauthenticated, "token inválido o expirado")
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "claims inválidos")
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "user_id no encontrado en el token")
		}

		// Inyectar el user_id en el contexto para que lo usen los servicios
		newCtx := context.WithValue(ctx, UserIDKey, uint(userIDFloat))

		return handler(newCtx, req)
	}
}
