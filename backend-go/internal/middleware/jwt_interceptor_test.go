package middleware

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const testSecret = "super-secret-key-development-only"

func tokenFirmado(t *testing.T, userID float64, secret string, exp time.Duration) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(exp).Unix(),
	})
	s, err := tok.SignedString([]byte(secret))
	require.NoError(t, err)
	return s
}

func ctxConAuth(header string) context.Context {
	if header == "" {
		return metadata.NewIncomingContext(context.Background(), metadata.MD{})
	}
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", header))
}

// ejecuta el interceptor y devuelve el user_id visto por el handler (si existe) y el error
func invocar(ctx context.Context, method string) (got interface{}, err error) {
	t := UnaryAuthInterceptor()
	_, err = t(ctx, nil, &grpc.UnaryServerInfo{FullMethod: method},
		func(c context.Context, _ interface{}) (interface{}, error) {
			got = c.Value(UserIDKey)
			return "ok", nil
		})
	return got, err
}

const (
	rutaPublica   = "/publication.PublicationService/ListPublications"
	rutaProtegida = "/publication.PublicationService/CreatePublication"
)

func TestUnaryAuthInterceptor_RutasPublicas(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)

	t.Run("con Bearer valido inyecta UserIDKey", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Bearer "+tokenFirmado(t, 7, testSecret, time.Hour)), rutaPublica)
		require.NoError(t, err)
		assert.Equal(t, uint(7), got)
	})

	t.Run("sin token sigue siendo publica y no inyecta", func(t *testing.T) {
		got, err := invocar(ctxConAuth(""), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("sin metadata sigue siendo publica", func(t *testing.T) {
		got, err := invocar(context.Background(), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("token invalido se trata como visitante, sin error", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Bearer token-basura"), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("token expirado se trata como visitante, sin error", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Bearer "+tokenFirmado(t, 7, testSecret, -time.Hour)), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("firmado con otra clave se trata como visitante", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Bearer "+tokenFirmado(t, 7, "otra-clave", time.Hour)), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("formato distinto de Bearer se trata como visitante", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Basic abc"), rutaPublica)
		require.NoError(t, err)
		assert.Nil(t, got)
	})
}

func TestUnaryAuthInterceptor_RutasProtegidas(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)

	t.Run("con Bearer valido inyecta UserIDKey", func(t *testing.T) {
		got, err := invocar(ctxConAuth("Bearer "+tokenFirmado(t, 3, testSecret, time.Hour)), rutaProtegida)
		require.NoError(t, err)
		assert.Equal(t, uint(3), got)
	})

	casos := []struct {
		nombre string
		ctx    context.Context
		msg    string
	}{
		{"sin metadata", context.Background(), "metadata no proporcionada"},
		{"sin header", ctxConAuth(""), "token de autorización no proporcionado"},
		{"formato invalido", ctxConAuth("Basic abc"), "formato de token inválido"},
		{"token basura", ctxConAuth("Bearer token-basura"), "token inválido o expirado"},
	}
	for _, c := range casos {
		t.Run("rechaza: "+c.nombre, func(t *testing.T) {
			_, err := invocar(c.ctx, rutaProtegida)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, codes.Unauthenticated, st.Code())
			assert.Equal(t, c.msg, st.Message())
		})
	}
}