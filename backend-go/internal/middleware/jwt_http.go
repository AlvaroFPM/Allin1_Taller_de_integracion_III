package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// HTTPAuth exige un JWT válido en el header Authorization (Bearer) y deja el
// user_id en el contexto con la misma clave (UserIDKey) que usa el interceptor gRPC.
func HTTPAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, err := userIDFromHTTP(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), UserIDKey, userID)))
	})
}

func userIDFromHTTP(r *http.Request) (uint, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return 0, errors.New("token de autorización no proporcionado")
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return 0, errors.New("formato de token inválido")
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
		return 0, errors.New("token inválido o expirado")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("claims inválidos")
	}
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok || userIDFloat <= 0 {
		return 0, errors.New("user_id no encontrado en el token")
	}
	return uint(userIDFloat), nil
}