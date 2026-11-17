package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	statuspb "google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/encoding/protojson"
)

func TestIAMIdentityContract(t *testing.T) {
	db := setupOrderTestDB(t)
	require.NoError(t, db.AutoMigrate(&models.Usuario{}, &models.ChatSala{}, &models.ChatMensaje{}))

	const secret = "all-140-integration-test-only"
	const password = "PruebaIAM140!"
	t.Setenv("JWT_SECRET", secret)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer(grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()))
	auth.RegisterAuthServiceServer(server, NewAuthService(db))
	orderspb.RegisterOrderServiceServer(server, NewOrderServiceServer(NewOrderService(db)))
	chatpb.RegisterChatServiceServer(server, NewChatServiceServer(db))
	go server.Serve(listener)
	t.Cleanup(server.Stop)

	conn, err := grpc.NewClient("passthrough:///iam-identity", grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	mux := runtime.NewServeMux()
	require.NoError(t, orderspb.RegisterOrderServiceHandler(ctx, mux, conn))
	require.NoError(t, chatpb.RegisterChatServiceHandler(ctx, mux, conn))

	iam := auth.NewAuthServiceClient(conn)
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	register := func(label string) (uint, string) {
		t.Helper()
		email := label + suffix + "@example.com"
		user, err := iam.Register(ctx, &auth.RegisterRequest{
			Rut: label + suffix, FirstName: "Prueba", LastName: "IAM", Email: email, Password: password,
		})
		require.NoError(t, err)
		require.Positive(t, user.GetUserId())
		return uint(user.GetUserId()), email
	}
	buyer, email := register("buyer")
	seller, _ := register("seller")
	other, _ := register("other")
	login, err := iam.Login(ctx, &auth.LoginRequest{Email: email, Password: password})
	require.NoError(t, err)
	require.NotEmpty(t, login.GetToken())

	ownOrder := models.Orden{IDUsuarioComprador: buyer, IDUsuarioVendedor: seller, IDPublicacion: 10, Precio: 1000}
	otherOrder := models.Orden{IDUsuarioComprador: other, IDUsuarioVendedor: seller, IDPublicacion: 10, Precio: 1000}
	require.NoError(t, db.Create(&ownOrder).Error)
	require.NoError(t, db.Create(&otherOrder).Error)
	ownRoom := models.ChatSala{CompradorID: buyer, VendedorID: seller}
	otherRoom := models.ChatSala{CompradorID: other, VendedorID: seller}
	require.NoError(t, db.Create(&ownRoom).Error)
	require.NoError(t, db.Create(&otherRoom).Error)

	request := func(method, path, token, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(ctx, method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", strconv.FormatUint(uint64(other), 10))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		return res
	}

	const purchases = "/v1/orders/mis-compras"
	const rooms = "/v1/chat/rooms"
	t.Run("Orders usa el comprador del token para listar compras", func(t *testing.T) {
		res := request(http.MethodGet, purchases, login.GetToken(), "")
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var list orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(res.Body.Bytes(), &list))
		require.Len(t, list.GetOrders(), 1)
		require.EqualValues(t, ownOrder.IDOrden, list.GetOrders()[0].GetIdOrden())
		require.EqualValues(t, buyer, list.GetOrders()[0].GetIdUsuarioComprador())
	})
	t.Run("Chat usa el token para listar salas y persistir el remitente", func(t *testing.T) {
		res := request(http.MethodGet, rooms, login.GetToken(), "")
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var list chatpb.ListRoomsResponse
		require.NoError(t, protojson.Unmarshal(res.Body.Bytes(), &list))
		require.Len(t, list.GetSalas(), 1)
		require.EqualValues(t, ownRoom.IDSala, list.GetSalas()[0].GetIdSala())

		body := fmt.Sprintf(`{"salaId":%d,"destinatarioId":%d,"contenido":"Prueba IAM"}`, ownRoom.IDSala, seller)
		res = request(http.MethodPost, "/v1/chat/messages", login.GetToken(), body)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var sent chatpb.SendMessageResponse
		require.NoError(t, protojson.Unmarshal(res.Body.Bytes(), &sent))
		require.NotZero(t, sent.GetMensaje().GetIdMensaje())
		var saved models.ChatMensaje
		require.NoError(t, db.First(&saved, sent.GetMensaje().GetIdMensaje()).Error)
		require.Equal(t, buyer, saved.RemitenteID)
		require.Equal(t, seller, saved.DestinatarioID)
	})

	sign := func(id int64, exp time.Time, key string) string {
		t.Helper()
		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": id, "exp": exp.Unix()}).SignedString([]byte(key))
		require.NoError(t, err)
		return token
	}
	now := time.Now()
	for _, tc := range []struct {
		name  string
		token string
	}{
		{name: "sin token"},
		{name: "malformado", token: "token-invalido"},
		{name: "expirado", token: sign(int64(buyer), now.Add(-time.Hour), secret)},
		{name: "firma incorrecta", token: sign(int64(buyer), now.Add(time.Hour), "otra-clave")},
		{name: "identidad inválida", token: sign(-7, now.Add(time.Hour), secret)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, path := range []string{purchases, rooms} {
				res := request(http.MethodGet, path, tc.token, "")
				require.Equal(t, http.StatusUnauthorized, res.Code, "%s: %s", path, res.Body.String())
				var body statuspb.Status
				require.NoError(t, protojson.Unmarshal(res.Body.Bytes(), &body))
				require.Equal(t, int32(codes.Unauthenticated), body.GetCode(), path)
			}
		})
	}
}
