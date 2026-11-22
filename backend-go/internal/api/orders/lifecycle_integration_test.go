package orders

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	publicationpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/protobuf/encoding/protojson"
)

func doAuthJSON(t *testing.T, method, url, token, jsonBody string) (int, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(jsonBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
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

func TestHTTPGateway_OrdersLifecycle_RealServices(t *testing.T) {
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("ORDERS_ENABLE_CREATION", "true")

	tx := setupOrdersRouterTestDB(t)
	require.NoError(t, tx.AutoMigrate(
		&models.Usuario{},
		&models.Categoria{},
		&models.Publicacion{},
		&models.Orden{},
	))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Servidor gRPC real de IAM
	iamLis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer iamLis.Close()

	iamGRPC := grpc.NewServer(grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()))
	auth.RegisterAuthServiceServer(iamGRPC, service.NewAuthService(tx))
	go func() {
		_ = iamGRPC.Serve(iamLis)
	}()
	defer iamGRPC.Stop()

	iamConn, err := grpc.NewClient(iamLis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	defer iamConn.Close()
	iamClient := auth.NewAuthServiceClient(iamConn)

	// Registrar e iniciar sesión con 3 cuentas reales en IAM
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	const password = "PruebaMVP150!"
	registerAndLogin := func(label, rutPrefix string) (uint32, string) {
		t.Helper()
		email := fmt.Sprintf("%s.%s@example.com", label, suffix)
		reg, err := iamClient.Register(ctx, &auth.RegisterRequest{
			Rut:       fmt.Sprintf("%s-%s", rutPrefix, suffix),
			FirstName: "Usuario",
			LastName:  label,
			Email:     email,
			Password:  password,
		})
		require.NoError(t, err)
		require.Positive(t, reg.GetUserId())

		login, err := iamClient.Login(ctx, &auth.LoginRequest{
			Email:    email,
			Password: password,
		})
		require.NoError(t, err)
		require.NotEmpty(t, login.GetToken())
		return uint32(reg.GetUserId()), login.GetToken()
	}

	vendedorID, vendedorToken := registerAndLogin("vendedor", "11")
	compradorID, compradorToken := registerAndLogin("comprador", "22")
	terceroID, terceroToken := registerAndLogin("tercero", "33")

	// 2. Categoría y servidor gRPC real de Catálogo
	cat := models.Categoria{
		Nombre: "Gasfiteria MVP " + suffix,
		Slug:   "gasfiteria-mvp-" + suffix,
	}
	require.NoError(t, tx.Create(&cat).Error)

	catalogLis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer catalogLis.Close()

	catalogGRPC := grpc.NewServer(grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()))
	publicationpb.RegisterPublicationServiceServer(catalogGRPC, service.NewPublicationServiceServer(tx))
	reflection.Register(catalogGRPC)
	go func() {
		_ = catalogGRPC.Serve(catalogLis)
	}()
	defer catalogGRPC.Stop()

	catalogConn, err := grpc.NewClient(catalogLis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	defer catalogConn.Close()
	catalogClient := publicationpb.NewPublicationServiceClient(catalogConn)

	ctxVendedor := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+vendedorToken)
	createPub := func(titulo string, tipo publicationpb.TipoServicio, precio int64) *publicationpb.Publication {
		t.Helper()
		resp, err := catalogClient.CreatePublication(ctxVendedor, &publicationpb.CreatePublicationRequest{
			IdUsuarioVendedor: vendedorID,
			CategoriaId:       uint32(cat.IDCategoria),
			Titulo:            titulo,
			Descripcion:       strings.Repeat("Servicio profesional verificado para pruebas reales de integracion MVP. ", 2),
			TipoServicio:      tipo,
			PrecioBase:        precio,
			Ciudad:            "Temuco",
			Region:            "Araucania",
		})
		require.NoError(t, err)
		require.NotNil(t, resp.GetPublication())
		return resp.GetPublication()
	}

	pubOferta := createPub("Reparacion electrica certificada", publicationpb.TipoServicio_OFERTA, 35000)
	pubDemanda := createPub("Busco tecnico en refrigeracion", publicationpb.TipoServicio_DEMANDA, 20000)
	pubPausada := createPub("Instalacion pausada temporalmente", publicationpb.TipoServicio_OFERTA, 15000)
	require.NoError(t, tx.Model(&models.Publicacion{}).
		Where("id_publicacion = ?", pubPausada.GetIdPublicacion()).
		Update("estado", models.EstadoPausado).Error)

	// 3. Servidor gRPC real de Orders conectado por gRPC TCP real a Catálogo + gRPC-Gateway HTTP
	ordersLis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ordersLis.Close()

	ordersGRPC := grpc.NewServer(grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()))
	orderService := service.NewOrderService(tx, catalogClient)
	orderServer := service.NewOrderServiceServer(orderService)
	RegisterGRPCRouter(ordersGRPC, orderServer)
	go func() {
		_ = ordersGRPC.Serve(ordersLis)
	}()
	defer ordersGRPC.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	require.NoError(t, RegisterGatewayRouter(ctx, mux, ordersLis.Addr().String(), opts))

	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	countOrders := func() int64 {
		t.Helper()
		var c int64
		require.NoError(t, tx.Model(&models.Orden{}).Count(&c).Error)
		return c
	}
	loadOrderState := func(orderID uint32) string {
		t.Helper()
		var o models.Orden
		require.NoError(t, tx.First(&o, orderID).Error)
		return o.Estado
	}

	var ordenPrincipalID uint32

	// Criterio 1: Publicación OFERTA activa con vendedor y precio reales produce orden PENDIENTE con comprador del JWT
	t.Run("1. Creacion validada contra Catalogo real persiste orden PENDIENTE", func(t *testing.T) {
		payload := fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"%d"}`,
			vendedorID, pubOferta.GetIdPublicacion(), pubOferta.GetPrecioBase())
		code, body := doAuthJSON(t, http.MethodPost, httpServer.URL+"/v1/orders", compradorToken, payload)
		require.Equal(t, http.StatusOK, code, string(body))
		t.Logf("EVIDENCIA_ALL150_CREATE_OK=%s", string(body))

		var resp orderspb.CreateOrderResponse
		require.NoError(t, protojson.Unmarshal(body, &resp))
		require.NotNil(t, resp.GetOrder())
		ordenPrincipalID = resp.GetOrder().GetIdOrden()
		assert.NotZero(t, ordenPrincipalID)
		assert.Equal(t, compradorID, resp.GetOrder().GetIdUsuarioComprador())
		assert.Equal(t, vendedorID, resp.GetOrder().GetIdUsuarioVendedor())
		assert.Equal(t, pubOferta.GetIdPublicacion(), resp.GetOrder().GetIdPublicacion())
		assert.Equal(t, orderspb.EstadoOrden_PENDIENTE, resp.GetOrder().GetEstado())
		assert.Equal(t, int64(35000), resp.GetOrder().GetPrecio())

		var enBD models.Orden
		require.NoError(t, tx.First(&enBD, ordenPrincipalID).Error)
		assert.Equal(t, uint(compradorID), enBD.IDUsuarioComprador)
		assert.Equal(t, uint(vendedorID), enBD.IDUsuarioVendedor)
		assert.Equal(t, models.EstadoOrdenPendiente, enBD.Estado)

		codeGet, bodyGet := doAuthGet(t, fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenPrincipalID), compradorToken)
		require.Equal(t, http.StatusOK, codeGet, string(bodyGet))

		codeList, bodyList := doAuthGet(t, httpServer.URL+"/v1/orders/mis-compras", compradorToken)
		require.Equal(t, http.StatusOK, codeList, string(bodyList))
		var listResp orderspb.ListOrdersResponse
		require.NoError(t, protojson.Unmarshal(bodyList, &listResp))
		require.Len(t, listResp.GetOrders(), 1)
		assert.Equal(t, ordenPrincipalID, listResp.GetOrders()[0].GetIdOrden())
	})

	// Criterio 2: Vendedor/precio manipulados, auto-compra, duplicado, DEMANDA, PAUSADO y sin token se rechazan sin persistir
	t.Run("2. Rechazos de creacion no persisten filas en PostgreSQL", func(t *testing.T) {
		countAntes := countOrders()
		casos := []struct {
			nombre   string
			token    string
			payload  string
			wantCode int
		}{
			{
				nombre:   "vendedor manipulado",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`, terceroID, pubOferta.GetIdPublicacion()),
				wantCode: http.StatusBadRequest,
			},
			{
				nombre:   "precio manipulado",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"100"}`, vendedorID, pubOferta.GetIdPublicacion()),
				wantCode: http.StatusBadRequest,
			},
			{
				nombre:   "auto-compra RN-21",
				token:    vendedorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`, vendedorID, pubOferta.GetIdPublicacion()),
				wantCode: http.StatusBadRequest,
			},
			{
				nombre:   "orden activa duplicada RN-22",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`, vendedorID, pubOferta.GetIdPublicacion()),
				wantCode: http.StatusConflict,
			},
			{
				nombre:   "publicacion DEMANDA bloqueada",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"20000"}`, vendedorID, pubDemanda.GetIdPublicacion()),
				wantCode: http.StatusBadRequest,
			},
			{
				nombre:   "publicacion PAUSADO bloqueada",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"15000"}`, vendedorID, pubPausada.GetIdPublicacion()),
				wantCode: http.StatusBadRequest,
			},
			{
				nombre:   "publicacion inexistente",
				token:    compradorToken,
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":9999999,"precio":"35000"}`, vendedorID),
				wantCode: http.StatusNotFound,
			},
			{
				nombre:   "sin token",
				token:    "",
				payload:  fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`, vendedorID, pubOferta.GetIdPublicacion()),
				wantCode: http.StatusUnauthorized,
			},
		}

		for _, tc := range casos {
			code, body := doAuthJSON(t, http.MethodPost, httpServer.URL+"/v1/orders", tc.token, tc.payload)
			assert.Equal(t, tc.wantCode, code, "%s: body=%s", tc.nombre, string(body))
			assert.Equal(t, countAntes, countOrders(), "%s no debe crear filas", tc.nombre)
		}
	})

	// Criterio 3: Recorrido PENDIENTE -> ACEPTADA -> COMPLETADA y rechazos que conservan BD
	t.Run("3. Ciclo completo de estados y rechazos por permisos o FSM", func(t *testing.T) {
		endpoint := fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenPrincipalID)
		aliasEndpoint := fmt.Sprintf("%s/v1/ordenes/%d", httpServer.URL, ordenPrincipalID)

		// Rechazos desde PENDIENTE
		for _, tc := range []struct {
			nombre   string
			token    string
			estado   string
			wantCode int
		}{
			{"tercero intenta ACEPTADA", terceroToken, "ACEPTADA", http.StatusForbidden},
			{"tercero intenta CANCELADA", terceroToken, "CANCELADA", http.StatusForbidden},
			{"comprador intenta ACEPTADA", compradorToken, "ACEPTADA", http.StatusForbidden},
			{"vendedor intenta saltar a COMPLETADA", vendedorToken, "COMPLETADA", http.StatusBadRequest},
			{"estado desconocido", vendedorToken, "ENVIADA", http.StatusBadRequest},
		} {
			code, body := doAuthJSON(t, http.MethodPatch, endpoint, tc.token, fmt.Sprintf(`{"nuevoEstado":%q}`, tc.estado))
			assert.Equal(t, tc.wantCode, code, "%s: %s", tc.nombre, string(body))
			assert.Equal(t, models.EstadoOrdenPendiente, loadOrderState(ordenPrincipalID))
		}

		// Vendedor acepta (PENDIENTE -> ACEPTADA)
		code, body := doAuthJSON(t, http.MethodPatch, endpoint, vendedorToken, `{"nuevoEstado":"ACEPTADA"}`)
		require.Equal(t, http.StatusOK, code, string(body))
		t.Logf("EVIDENCIA_ALL150_PATCH_ACEPTADA=%s", string(body))
		assert.Equal(t, models.EstadoOrdenAceptada, loadOrderState(ordenPrincipalID))

		// Rechazos desde ACEPTADA
		code, _ = doAuthJSON(t, http.MethodPatch, endpoint, terceroToken, `{"nuevoEstado":"COMPLETADA"}`)
		assert.Equal(t, http.StatusForbidden, code)
		code, _ = doAuthJSON(t, http.MethodPatch, endpoint, vendedorToken, `{"nuevoEstado":"PENDIENTE"}`)
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Equal(t, models.EstadoOrdenAceptada, loadOrderState(ordenPrincipalID))

		// Comprador completa usando el alias /v1/ordenes/{id} (ACEPTADA -> COMPLETADA)
		code, body = doAuthJSON(t, http.MethodPatch, aliasEndpoint, compradorToken, `{"nuevoEstado":"COMPLETADA"}`)
		require.Equal(t, http.StatusOK, code, string(body))
		t.Logf("EVIDENCIA_ALL150_PATCH_COMPLETADA=%s", string(body))
		assert.Equal(t, models.EstadoOrdenCompletada, loadOrderState(ordenPrincipalID))

		// Inmutabilidad en COMPLETADA
		for _, tc := range []struct {
			token  string
			estado string
		}{
			{compradorToken, "CANCELADA"},
			{vendedorToken, "ACEPTADA"},
		} {
			code, _ = doAuthJSON(t, http.MethodPatch, endpoint, tc.token, fmt.Sprintf(`{"nuevoEstado":%q}`, tc.estado))
			assert.Equal(t, http.StatusBadRequest, code)
			assert.Equal(t, models.EstadoOrdenCompletada, loadOrderState(ordenPrincipalID))
		}
	})

	// Criterio 3b: Cancelación en casos separados (PENDIENTE -> CANCELADA y ACEPTADA -> CANCELADA)
	t.Run("4. Cancelacion por comprador desde PENDIENTE y por vendedor desde ACEPTADA", func(t *testing.T) {
		createNew := func() uint32 {
			payload := fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`,
				vendedorID, pubOferta.GetIdPublicacion())
			code, body := doAuthJSON(t, http.MethodPost, httpServer.URL+"/v1/orders", compradorToken, payload)
			require.Equal(t, http.StatusOK, code, string(body))
			var resp orderspb.CreateOrderResponse
			require.NoError(t, protojson.Unmarshal(body, &resp))
			return resp.GetOrder().GetIdOrden()
		}

		// Caso A: Comprador cancela en PENDIENTE
		ordenCancelPendiente := createNew()
		code, body := doAuthJSON(t, http.MethodPatch,
			fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenCancelPendiente),
			compradorToken, `{"nuevoEstado":"CANCELADA"}`)
		require.Equal(t, http.StatusOK, code, string(body))
		assert.Equal(t, models.EstadoOrdenCancelada, loadOrderState(ordenCancelPendiente))

		// Inmutabilidad tras CANCELADA
		code, _ = doAuthJSON(t, http.MethodPatch,
			fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenCancelPendiente),
			vendedorToken, `{"nuevoEstado":"ACEPTADA"}`)
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Equal(t, models.EstadoOrdenCancelada, loadOrderState(ordenCancelPendiente))

		// Caso B: Vendedor acepta y luego cancela en ACEPTADA
		ordenCancelAceptada := createNew()
		code, _ = doAuthJSON(t, http.MethodPatch,
			fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenCancelAceptada),
			vendedorToken, `{"nuevoEstado":"ACEPTADA"}`)
		require.Equal(t, http.StatusOK, code)
		code, body = doAuthJSON(t, http.MethodPatch,
			fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenCancelAceptada),
			vendedorToken, `{"nuevoEstado":"CANCELADA"}`)
		require.Equal(t, http.StatusOK, code, string(body))
		t.Logf("EVIDENCIA_ALL150_PATCH_CANCELADA=%s", string(body))
		assert.Equal(t, models.EstadoOrdenCancelada, loadOrderState(ordenCancelAceptada))

		code, _ = doAuthJSON(t, http.MethodPatch,
			fmt.Sprintf("%s/v1/orders/%d", httpServer.URL, ordenCancelAceptada),
			compradorToken, `{"nuevoEstado":"COMPLETADA"}`)
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Equal(t, models.EstadoOrdenCancelada, loadOrderState(ordenCancelAceptada))
	})

	// Criterio 2b: Fallo real de Catálogo retorna 503 sin persistir orden
	t.Run("5. Caida real de Catalogo rechaza creacion con 503 sin persistir", func(t *testing.T) {
		countAntes := countOrders()
		catalogGRPC.Stop()

		payload := fmt.Sprintf(`{"idUsuarioVendedor":%d,"idPublicacion":%d,"precio":"35000"}`,
			vendedorID, pubOferta.GetIdPublicacion())
		code, body := doAuthJSON(t, http.MethodPost, httpServer.URL+"/v1/orders", compradorToken, payload)
		assert.Equal(t, http.StatusServiceUnavailable, code, string(body))
		t.Logf("EVIDENCIA_ALL150_CATALOG_DOWN=%s", string(body))
		assert.Equal(t, countAntes, countOrders())

		var raw map[string]interface{}
		require.NoError(t, json.Unmarshal(body, &raw))
		assert.Equal(t, float64(14), raw["code"]) // codes.Unavailable == 14
	})
}
