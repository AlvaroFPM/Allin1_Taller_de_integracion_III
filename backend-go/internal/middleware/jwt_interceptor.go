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
			"/auth.AuthService/Login":                          true,
			"/auth.AuthService/Register":                       true,
			"/publication.PublicationService/GetCategories":    true,
			"/publication.PublicationService/GetPublication":   true,
			"/publication.PublicationService/ListPublications": true,
		}

		if publicRoutes[info.FullMethod] {
			// Autenticación opcional: si viene un Bearer válido se inyecta el user_id
			// (p. ej. para que ListPublications excluya las publicaciones del usuario logueado, RN-12).
			// Si el token falta o es inválido/expirado, se continúa como visitante, sin error.
			if userID, err := userIDFromToken(ctx); err == nil {
				ctx = context.WithValue(ctx, UserIDKey, userID)
			}
			return handler(ctx, req)
		}

		userID, err := userIDFromToken(ctx)
		if err != nil {
			return nil, err
		}

		// Inyectar el user_id en el contexto para que lo usen los servicios
		return handler(context.WithValue(ctx, UserIDKey, userID), req)
	}
}

// userIDFromToken extrae y valida el JWT del metadata y devuelve el user_id.
// Devuelve un error gRPC Unauthenticated si el token falta o no es válido.
func userIDFromToken(ctx context.Context) (uint, error) {
	// Extraer metadata del contexto (grpc-gateway pasa los headers HTTP aquí)
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return 0, status.Errorf(codes.Unauthenticated, "metadata no proporcionada")
	}

	// El header "Authorization" se convierte a minúsculas en gRPC metadata
	values := md["authorization"]
	if len(values) == 0 {
		// Intentar con "grpcgateway-authorization" por si acaso
		values = md["grpcgateway-authorization"]
		if len(values) == 0 {
			return 0, status.Errorf(codes.Unauthenticated, "token de autorización no proporcionado")
		}
	}

	authHeader := values[0]
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return 0, status.Errorf(codes.Unauthenticated, "formato de token inválido")
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
		return 0, status.Errorf(codes.Unauthenticated, "token inválido o expirado")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, status.Errorf(codes.Unauthenticated, "claims inválidos")
	}

	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0, status.Errorf(codes.Unauthenticated, "user_id no encontrado en el token")
	}

	return uint(userIDFloat), nil
}