package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// getEnvOrDefault obtiene una variable de entorno o retorna el valor por defecto
// (apunta por defecto al contenedor local de postgres_catalog en el puerto 5434).
func getOrderTestEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

// setupOrderTestDB conecta a PostgreSQL local, migra la tabla 'ordenes' y devuelve
// una transacción aislada que hace Rollback automático al terminar cada test.
func setupOrderTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	// En GitHub Actions (CI) no se levanta contenedor de PostgreSQL; se salta el test de BD
	if os.Getenv("CI") != "" {
		t.Skip("Saltando test de integración de BD en entorno CI")
	}

	host := getOrderTestEnv("DB_HOST", "localhost")
	port := getOrderTestEnv("DB_PORT", "5434")
	user := getOrderTestEnv("DB_USER", "catalog_user")
	password := getOrderTestEnv("DB_PASSWORD", "catalog_password")
	dbname := getOrderTestEnv("DB_NAME", "catalog_db")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("PostgreSQL local no disponible (%v). Levanta docker compose para correr tests de BD.", err)
	}

	// Asegurar que la tabla 'ordenes' exista con el esquema de ALL-75
	require.NoError(t, db.AutoMigrate(&models.Orden{}))

	// Iniciar transacción que se deshará automáticamente al finalizar el test
	tx := db.Begin()
	require.NoError(t, tx.Error)

	t.Cleanup(func() {
		tx.Rollback()
	})

	return tx
}

// ============================================================================
// 1. TESTS UNITARIOS PUROS (Sin Base de Datos — Siempre corren en local y CI)
// ============================================================================

func TestValidateCreateOrder_PureValidation(t *testing.T) {
	tests := []struct {
		name          string
		compradorID   uint
		vendedorID    uint
		publicacionID uint
		precio        int64
		wantCode      codes.Code
		wantMsgPart   string
	}{
		{
			name:          "Caso válido: todos los campos correctos",
			compradorID:   7,
			vendedorID:    3,
			publicacionID: 10,
			precio:        15000,
			wantCode:      codes.OK,
		},
		{
			name:          "Falla si compradorID es 0",
			compradorID:   0,
			vendedorID:    3,
			publicacionID: 10,
			precio:        15000,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "comprador es obligatorio",
		},
		{
			name:          "Falla si vendedorID es 0",
			compradorID:   7,
			vendedorID:    0,
			publicacionID: 10,
			precio:        15000,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "vendedor es obligatorio",
		},
		{
			name:          "Falla si publicacionID es 0",
			compradorID:   7,
			vendedorID:    3,
			publicacionID: 0,
			precio:        15000,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "publicación es obligatorio",
		},
		{
			name:          "RN-21: Falla si comprador y vendedor son la misma persona (auto-compra)",
			compradorID:   5,
			vendedorID:    5,
			publicacionID: 10,
			precio:        15000,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "RN-21",
		},
		{
			name:          "RN-23: Falla si el precio es 0",
			compradorID:   7,
			vendedorID:    3,
			publicacionID: 10,
			precio:        0,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "RN-23",
		},
		{
			name:          "RN-23: Falla si el precio es negativo",
			compradorID:   7,
			vendedorID:    3,
			publicacionID: 10,
			precio:        -5000,
			wantCode:      codes.InvalidArgument,
			wantMsgPart:   "RN-23",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateCreateOrder(tc.compradorID, tc.vendedorID, tc.publicacionID, tc.precio)

			if tc.wantCode == codes.OK {
				assert.NoError(t, err)
				return
			}

			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok, "el error debe ser un status gRPC válido")
			assert.Equal(t, tc.wantCode, st.Code())
			assert.Contains(t, st.Message(), tc.wantMsgPart)
		})
	}
}

// ============================================================================
// 2. TESTS DE INTEGRACIÓN CON POSTGRESQL (ALL-76: Persistencia y Duplicados)
// ============================================================================

func TestCreateOrder_Success(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	orden, err := svc.CreateOrder(ctx, 7, 3, 10, 25000)
	require.NoError(t, err)
	require.NotNil(t, orden)

	// Verificar campos asignados
	assert.NotZero(t, orden.IDOrden, "GORM debe asignar un ID autoincremental")
	assert.Equal(t, uint(7), orden.IDUsuarioComprador)
	assert.Equal(t, uint(3), orden.IDUsuarioVendedor)
	assert.Equal(t, uint(10), orden.IDPublicacion)
	assert.Equal(t, int64(25000), orden.Precio)
	assert.Equal(t, models.EstadoOrdenPendiente, orden.Estado)
	assert.False(t, orden.CreatedAt.IsZero(), "fecha_creacion debe llenarse automáticamente")
}

func TestCreateOrder_DuplicateActiveOrder_Rejected_RN22(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Primera orden de Ana (7) para la publicación 10 -> Debe funcionar
	primera, err := svc.CreateOrder(ctx, 7, 3, 10, 10000)
	require.NoError(t, err)
	require.NotNil(t, primera)

	// 2. Segunda orden idéntica de Ana (7) mientras la primera sigue PENDIENTE -> Debe fallar con AlreadyExists
	segunda, err := svc.CreateOrder(ctx, 7, 3, 10, 10000)
	assert.Nil(t, segunda)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.AlreadyExists, st.Code())
	assert.Contains(t, st.Message(), "RN-22")
}

func TestCreateOrder_AllowsNewOrderIfPreviousWasCancelledOrCompleted(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// Insertamos manualmente una orden antigua que ya fue CANCELADA
	ordenAntigua := models.Orden{
		IDUsuarioComprador: 7,
		IDUsuarioVendedor:  3,
		IDPublicacion:      10,
		Estado:             models.EstadoOrdenCancelada,
		Precio:             10000,
	}
	require.NoError(t, tx.Create(&ordenAntigua).Error)

	// Si Ana vuelve a contratar la publicación 10 ahora, el sistema SÍ debe permitirlo
	nueva, err := svc.CreateOrder(ctx, 7, 3, 10, 12000)
	require.NoError(t, err)
	require.NotNil(t, nueva)
	assert.Equal(t, models.EstadoOrdenPendiente, nueva.Estado)
	assert.NotEqual(t, ordenAntigua.IDOrden, nueva.IDOrden)
}

// ============================================================================
// 3. TESTS UNITARIOS PUROS DE TRANSICIÓN Y PERMISOS (ALL-77)
// ============================================================================

func TestValidateOrderTransition_PureValidation(t *testing.T) {
	tests := []struct {
		name         string
		estadoActual string
		nuevoEstado  string
		wantCode     codes.Code
		wantErrPart  string
	}{
		// Transiciones válidas
		{
			name:         "Éxito: PENDIENTE -> ACEPTADA",
			estadoActual: models.EstadoOrdenPendiente,
			nuevoEstado:  models.EstadoOrdenAceptada,
			wantCode:     codes.OK,
		},
		{
			name:         "Éxito: PENDIENTE -> CANCELADA",
			estadoActual: models.EstadoOrdenPendiente,
			nuevoEstado:  models.EstadoOrdenCancelada,
			wantCode:     codes.OK,
		},
		{
			name:         "Éxito: ACEPTADA -> COMPLETADA",
			estadoActual: models.EstadoOrdenAceptada,
			nuevoEstado:  models.EstadoOrdenCompletada,
			wantCode:     codes.OK,
		},
		{
			name:         "Éxito: ACEPTADA -> CANCELADA",
			estadoActual: models.EstadoOrdenAceptada,
			nuevoEstado:  models.EstadoOrdenCancelada,
			wantCode:     codes.OK,
		},

		// Transiciones inválidas
		{
			name:         "Falla: PENDIENTE -> COMPLETADA (salto de etapa)",
			estadoActual: models.EstadoOrdenPendiente,
			nuevoEstado:  models.EstadoOrdenCompletada,
			wantCode:     codes.FailedPrecondition,
			wantErrPart:  "no se puede pasar de PENDIENTE a COMPLETADA",
		},
		{
			name:         "Falla: ACEPTADA -> PENDIENTE (regresión de estado)",
			estadoActual: models.EstadoOrdenAceptada,
			nuevoEstado:  models.EstadoOrdenPendiente,
			wantCode:     codes.FailedPrecondition,
			wantErrPart:  "no se puede pasar de ACEPTADA a PENDIENTE",
		},
		{
			name:         "Falla: COMPLETADA -> CANCELADA (estado final inmutable)",
			estadoActual: models.EstadoOrdenCompletada,
			nuevoEstado:  models.EstadoOrdenCancelada,
			wantCode:     codes.FailedPrecondition,
			wantErrPart:  "transición no permitida",
		},
		{
			name:         "Falla: CANCELADA -> ACEPTADA (estado final inmutable)",
			estadoActual: models.EstadoOrdenCancelada,
			nuevoEstado:  models.EstadoOrdenAceptada,
			wantCode:     codes.FailedPrecondition,
			wantErrPart:  "transición no permitida",
		},
		{
			name:         "Falla: estado pedido no existe en el dominio",
			estadoActual: models.EstadoOrdenPendiente,
			nuevoEstado:  "ENVIADA",
			wantCode:     codes.InvalidArgument,
			wantErrPart:  "estado de orden desconocido",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateOrderTransition(tc.estadoActual, tc.nuevoEstado)
			if tc.wantCode == codes.OK {
				assert.NoError(t, err)
				return
			}

			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tc.wantCode, st.Code())
			assert.Contains(t, st.Message(), tc.wantErrPart)
		})
	}
}

func TestValidateOrderPermissions_PureValidation(t *testing.T) {
	ordenBase := models.Orden{
		IDOrden:            1,
		IDUsuarioComprador: 10,
		IDUsuarioVendedor:  20,
		Estado:             models.EstadoOrdenPendiente,
	}

	tests := []struct {
		name        string
		usuarioID   uint
		nuevoEstado string
		wantCode    codes.Code
		wantErrPart string
	}{
		// Aceptar orden
		{
			name:        "Éxito: Vendedor acepta la orden",
			usuarioID:   20,
			nuevoEstado: models.EstadoOrdenAceptada,
			wantCode:    codes.OK,
		},
		{
			name:        "Falla: Comprador intenta aceptar su propia orden",
			usuarioID:   10,
			nuevoEstado: models.EstadoOrdenAceptada,
			wantCode:    codes.PermissionDenied,
			wantErrPart: "solo el vendedor puede aceptar",
		},
		{
			name:        "Falla: Tercero ajeno intenta aceptar la orden",
			usuarioID:   99,
			nuevoEstado: models.EstadoOrdenAceptada,
			wantCode:    codes.PermissionDenied,
			wantErrPart: "no tienes autorización",
		},

		// Completar orden
		{
			name:        "Éxito: Vendedor completa la orden",
			usuarioID:   20,
			nuevoEstado: models.EstadoOrdenCompletada,
			wantCode:    codes.OK,
		},
		{
			name:        "Éxito: Comprador completa la orden",
			usuarioID:   10,
			nuevoEstado: models.EstadoOrdenCompletada,
			wantCode:    codes.OK,
		},
		{
			name:        "Falla: Tercero ajeno intenta completar la orden",
			usuarioID:   99,
			nuevoEstado: models.EstadoOrdenCompletada,
			wantCode:    codes.PermissionDenied,
			wantErrPart: "no tienes autorización",
		},

		// Cancelar orden
		{
			name:        "Éxito: Comprador cancela la orden",
			usuarioID:   10,
			nuevoEstado: models.EstadoOrdenCancelada,
			wantCode:    codes.OK,
		},
		{
			name:        "Éxito: Vendedor cancela la orden",
			usuarioID:   20,
			nuevoEstado: models.EstadoOrdenCancelada,
			wantCode:    codes.OK,
		},
		{
			name:        "Falla: Tercero ajeno intenta cancelar la orden",
			usuarioID:   99,
			nuevoEstado: models.EstadoOrdenCancelada,
			wantCode:    codes.PermissionDenied,
			wantErrPart: "no tienes autorización",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateOrderPermissions(&ordenBase, tc.usuarioID, tc.nuevoEstado)
			if tc.wantCode == codes.OK {
				assert.NoError(t, err)
				return
			}

			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tc.wantCode, st.Code())
			assert.Contains(t, st.Message(), tc.wantErrPart)
		})
	}
}

// ============================================================================
// 4. TESTS DE INTEGRACIÓN DE BD PARA PATCH (ALL-77)
// ============================================================================

func TestPatchOrderStatus_SuccessCycle(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Crear orden inicial en PENDIENTE
	orden, err := svc.CreateOrder(ctx, 10, 20, 5, 30000)
	require.NoError(t, err)
	require.Equal(t, models.EstadoOrdenPendiente, orden.Estado)

	// 2. Vendedor (20) acepta la orden
	ordenAceptada, err := svc.PatchOrderStatus(ctx, orden.IDOrden, 20, models.EstadoOrdenAceptada)
	require.NoError(t, err)
	assert.Equal(t, models.EstadoOrdenAceptada, ordenAceptada.Estado)

	// 3. Comprador (10) completa la orden
	ordenCompletada, err := svc.PatchOrderStatus(ctx, orden.IDOrden, 10, models.EstadoOrdenCompletada)
	require.NoError(t, err)
	assert.Equal(t, models.EstadoOrdenCompletada, ordenCompletada.Estado)
}

func TestPatchOrderStatus_FailsIfOrderNotFound(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	res, err := svc.PatchOrderStatus(ctx, 99999, 20, models.EstadoOrdenAceptada)
	assert.Nil(t, res)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.NotFound, st.Code())
}

// ============================================================================
// 5. TESTS UNITARIOS PUROS PARA GET ÓRDENES (ALL-78)
// ============================================================================

func TestOrder_NormalizePagination_PureValidation(t *testing.T) {
	tests := []struct {
		name       string
		page       int32
		limit      int32
		wantPage   int32
		wantLimit  int32
		wantOffset int
	}{
		{
			name:       "Valores normales válidos",
			page:       2,
			limit:      20,
			wantPage:   2,
			wantLimit:  20,
			wantOffset: 20,
		},
		{
			name:       "Page menor a 1 se normaliza a 1",
			page:       0,
			limit:      15,
			wantPage:   1,
			wantLimit:  15,
			wantOffset: 0,
		},
		{
			name:       "Page negativa se normaliza a 1",
			page:       -3,
			limit:      10,
			wantPage:   1,
			wantLimit:  10,
			wantOffset: 0,
		},
		{
			name:       "Limit menor o igual a 0 se normaliza a 10 por defecto",
			page:       1,
			limit:      0,
			wantPage:   1,
			wantLimit:  10,
			wantOffset: 0,
		},
		{
			name:       "Limit negativo se normaliza a 10 por defecto",
			page:       1,
			limit:      -5,
			wantPage:   1,
			wantLimit:  10,
			wantOffset: 0,
		},
		{
			name:       "Limit sobre 100 se recorta al máximo permitido de 100",
			page:       3,
			limit:      250,
			wantPage:   3,
			wantLimit:  100,
			wantOffset: 200,
		},
		{
			name:       "Límite exacto de 100 se mantiene",
			page:       1,
			limit:      100,
			wantPage:   1,
			wantLimit:  100,
			wantOffset: 0,
		},
		{
			name:       "Página muy grande no desborda offset y calcula valor positivo en 64 bits",
			page:       30000000,
			limit:      100,
			wantPage:   30000000,
			wantLimit:  100,
			wantOffset: 2999999900,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotPage, gotLimit, gotOffset := normalizePagination(tc.page, tc.limit)
			assert.Equal(t, tc.wantPage, gotPage)
			assert.Equal(t, tc.wantLimit, gotLimit)
			assert.Equal(t, tc.wantOffset, gotOffset)
		})
	}
}

func TestValidateOrderFilterState_PureValidation(t *testing.T) {
	tests := []struct {
		name        string
		estado      string
		wantCode    codes.Code
		wantErrPart string
	}{
		{
			name:     "Estado vacío no devuelve error (no se filtra)",
			estado:   "",
			wantCode: codes.OK,
		},
		{
			name:     "Estado PENDIENTE es válido",
			estado:   models.EstadoOrdenPendiente,
			wantCode: codes.OK,
		},
		{
			name:     "Estado ACEPTADA es válido",
			estado:   models.EstadoOrdenAceptada,
			wantCode: codes.OK,
		},
		{
			name:     "Estado COMPLETADA es válido",
			estado:   models.EstadoOrdenCompletada,
			wantCode: codes.OK,
		},
		{
			name:     "Estado CANCELADA es válido",
			estado:   models.EstadoOrdenCancelada,
			wantCode: codes.OK,
		},
		{
			name:        "Estado no reconocido retorna InvalidArgument",
			estado:      "ESTADO_DESCONOCIDO",
			wantCode:    codes.InvalidArgument,
			wantErrPart: "estado de orden inválido",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateOrderFilterState(tc.estado)
			if tc.wantCode == codes.OK {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tc.wantCode, st.Code())
			assert.Contains(t, st.Message(), tc.wantErrPart)
		})
	}
}

func TestListOrders_UserZero_ReturnsUnauthenticated_Pure(t *testing.T) {
	svc := NewOrderService(nil)
	ctx := context.Background()

	// ListMyPurchases con compradorID = 0
	compras, totalCompras, errCompras := svc.ListMyPurchases(ctx, 0, 1, 10, nil)
	assert.Nil(t, compras)
	assert.Equal(t, int64(0), totalCompras)
	require.Error(t, errCompras)
	stCompras, ok := status.FromError(errCompras)
	require.True(t, ok)
	assert.Equal(t, codes.Unauthenticated, stCompras.Code())
	assert.Contains(t, stCompras.Message(), "usuario no autenticado")

	// ListMySales con vendedorID = 0
	ventas, totalVentas, errVentas := svc.ListMySales(ctx, 0, 1, 10, nil)
	assert.Nil(t, ventas)
	assert.Equal(t, int64(0), totalVentas)
	require.Error(t, errVentas)
	stVentas, ok := status.FromError(errVentas)
	require.True(t, ok)
	assert.Equal(t, codes.Unauthenticated, stVentas.Code())
	assert.Contains(t, stVentas.Message(), "usuario no autenticado")
}

func TestListOrders_InvalidState_ReturnsInvalidArgument_Pure(t *testing.T) {
	svc := NewOrderService(nil)
	ctx := context.Background()
	estadoInvalido := "ESTADO_INEXISTENTE"

	// ListMyPurchases con estado inválido
	compras, totalCompras, errCompras := svc.ListMyPurchases(ctx, 10, 1, 10, &estadoInvalido)
	assert.Nil(t, compras)
	assert.Equal(t, int64(0), totalCompras)
	require.Error(t, errCompras)
	stCompras, ok := status.FromError(errCompras)
	require.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, stCompras.Code())

	// ListMySales con estado inválido
	ventas, totalVentas, errVentas := svc.ListMySales(ctx, 20, 1, 10, &estadoInvalido)
	assert.Nil(t, ventas)
	assert.Equal(t, int64(0), totalVentas)
	require.Error(t, errVentas)
	stVentas, ok := status.FromError(errVentas)
	require.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, stVentas.Code())

	// Estado con espacios alrededor pero válido (ej. "  PENDIENTE  ") se recorta y se acepta
	estadoEspaciado := "  PENDIENTE  "
	errEspaciado := validateOrderFilterState(strings.TrimSpace(estadoEspaciado))
	assert.NoError(t, errEspaciado)
}

// ============================================================================
// 6. TESTS DE INTEGRACIÓN DE BD PARA GET ÓRDENES (ALL-78)
// ============================================================================

func TestListOrders_AislamientoPorComprador(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Crear 2 órdenes para el comprador 101 (con diferentes publicaciones y vendedores)
	orden1, err := svc.CreateOrder(ctx, 101, 201, 10, 15000)
	require.NoError(t, err)
	orden2, err := svc.CreateOrder(ctx, 101, 202, 11, 25000)
	require.NoError(t, err)

	// 2. Crear 1 orden para el comprador 102
	orden3, err := svc.CreateOrder(ctx, 102, 201, 12, 35000)
	require.NoError(t, err)

	// 3. Consultar compras del comprador 101
	compras101, total101, err := svc.ListMyPurchases(ctx, 101, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total101)
	require.Len(t, compras101, 2)
	for _, o := range compras101 {
		assert.Equal(t, uint(101), o.IDUsuarioComprador)
	}

	// 4. Consultar compras del comprador 102
	compras102, total102, err := svc.ListMyPurchases(ctx, 102, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total102)
	require.Len(t, compras102, 1)
	assert.Equal(t, orden3.IDOrden, compras102[0].IDOrden)
	assert.Equal(t, uint(102), compras102[0].IDUsuarioComprador)

	// Verificar que las órdenes de 101 no aparecen en 102
	assert.NotEqual(t, orden1.IDOrden, compras102[0].IDOrden)
	assert.NotEqual(t, orden2.IDOrden, compras102[0].IDOrden)
}

func TestListOrders_ComprasYVentasNoSeMezclan(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// Usuario 50 es COMPRADOR en ordenA (vendedor 60)
	ordenA, err := svc.CreateOrder(ctx, 50, 60, 20, 10000)
	require.NoError(t, err)

	// Usuario 50 es VENDEDOR en ordenB (comprador 70)
	ordenB, err := svc.CreateOrder(ctx, 70, 50, 21, 20000)
	require.NoError(t, err)

	// ListMyPurchases para usuario 50 debe traer SOLO ordenA
	compras, totalCompras, err := svc.ListMyPurchases(ctx, 50, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(1), totalCompras)
	require.Len(t, compras, 1)
	assert.Equal(t, ordenA.IDOrden, compras[0].IDOrden)
	assert.Equal(t, uint(50), compras[0].IDUsuarioComprador)

	// ListMySales para usuario 50 debe traer SOLO ordenB
	ventas, totalVentas, err := svc.ListMySales(ctx, 50, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(1), totalVentas)
	require.Len(t, ventas, 1)
	assert.Equal(t, ordenB.IDOrden, ventas[0].IDOrden)
	assert.Equal(t, uint(50), ventas[0].IDUsuarioVendedor)
}

func TestListOrders_FiltroPorEstado(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Crear 3 órdenes para el comprador 80
	oPendiente, err := svc.CreateOrder(ctx, 80, 90, 31, 10000)
	require.NoError(t, err)

	oAceptada, err := svc.CreateOrder(ctx, 80, 91, 32, 20000)
	require.NoError(t, err)
	_, err = svc.PatchOrderStatus(ctx, oAceptada.IDOrden, 91, models.EstadoOrdenAceptada)
	require.NoError(t, err)

	oCompletada, err := svc.CreateOrder(ctx, 80, 92, 33, 30000)
	require.NoError(t, err)
	_, err = svc.PatchOrderStatus(ctx, oCompletada.IDOrden, 92, models.EstadoOrdenAceptada)
	require.NoError(t, err)
	_, err = svc.PatchOrderStatus(ctx, oCompletada.IDOrden, 80, models.EstadoOrdenCompletada)
	require.NoError(t, err)

	// 2. Filtrar por ACEPTADA
	estadoAceptada := models.EstadoOrdenAceptada
	resAceptada, totalAceptada, err := svc.ListMyPurchases(ctx, 80, 1, 10, &estadoAceptada)
	require.NoError(t, err)
	assert.Equal(t, int64(1), totalAceptada)
	require.Len(t, resAceptada, 1)
	assert.Equal(t, oAceptada.IDOrden, resAceptada[0].IDOrden)
	assert.Equal(t, models.EstadoOrdenAceptada, resAceptada[0].Estado)

	// 3. Filtrar por COMPLETADA
	estadoCompletada := models.EstadoOrdenCompletada
	resCompletada, totalCompletada, err := svc.ListMyPurchases(ctx, 80, 1, 10, &estadoCompletada)
	require.NoError(t, err)
	assert.Equal(t, int64(1), totalCompletada)
	require.Len(t, resCompletada, 1)
	assert.Equal(t, oCompletada.IDOrden, resCompletada[0].IDOrden)
	assert.Equal(t, models.EstadoOrdenCompletada, resCompletada[0].Estado)

	// 4. Filtrar por PENDIENTE con espacios alrededor (" PENDIENTE ") debe funcionar por el trim
	estadoPendienteEspaciada := " PENDIENTE "
	resPendiente, totalPendiente, err := svc.ListMyPurchases(ctx, 80, 1, 10, &estadoPendienteEspaciada)
	require.NoError(t, err)
	assert.Equal(t, int64(1), totalPendiente)
	require.Len(t, resPendiente, 1)
	assert.Equal(t, oPendiente.IDOrden, resPendiente[0].IDOrden)
	assert.Equal(t, models.EstadoOrdenPendiente, resPendiente[0].Estado)

	// 5. Sin filtro de estado (nil) retorna las 3 órdenes
	resTodas, totalTodas, err := svc.ListMyPurchases(ctx, 80, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(3), totalTodas)
	assert.Len(t, resTodas, 3)
}

func TestListOrders_Paginacion(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// Crear 3 órdenes para el comprador 95
	o1, err := svc.CreateOrder(ctx, 95, 101, 41, 10000)
	require.NoError(t, err)
	o2, err := svc.CreateOrder(ctx, 95, 102, 42, 20000)
	require.NoError(t, err)
	o3, err := svc.CreateOrder(ctx, 95, 103, 43, 30000)
	require.NoError(t, err)

	// Como el orden es fecha_creacion DESC, id_orden DESC:
	// La más reciente es o3, luego o2, luego o1.

	// Página 1 con limit=2 debe devolver exactamente [o3, o2]
	pag1, total1, err := svc.ListMyPurchases(ctx, 95, 1, 2, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total1, "el total de registros debe ser 3")
	require.Len(t, pag1, 2, "la página 1 debe devolver exactamente 2 órdenes")
	assert.Equal(t, o3.IDOrden, pag1[0].IDOrden, "el primer elemento de la pág 1 debe ser o3")
	assert.Equal(t, o2.IDOrden, pag1[1].IDOrden, "el segundo elemento de la pág 1 debe ser o2")

	// Página 2 con limit=2 debe devolver exactamente [o1]
	pag2, total2, err := svc.ListMyPurchases(ctx, 95, 2, 2, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total2, "el total de registros debe seguir siendo 3")
	require.Len(t, pag2, 1, "la página 2 debe devolver la orden restante")
	assert.Equal(t, o1.IDOrden, pag2[0].IDOrden, "el único elemento de la pág 2 debe ser o1")
}

func TestListOrders_OrdenDescendenteFecha(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Crear orden antigua (tendrá id_orden menor)
	ordenAntigua, err := svc.CreateOrder(ctx, 110, 210, 51, 10000)
	require.NoError(t, err)

	// 2. Crear orden reciente (tendrá id_orden mayor)
	ordenReciente, err := svc.CreateOrder(ctx, 110, 211, 52, 20000)
	require.NoError(t, err)

	// 3. Para verificar rigurosamente que el criterio principal es la FECHA y no el id_orden DESC,
	// modificamos explícitamente ordenReciente (con mayor ID) para que tenga fecha anterior (hace 2 horas),
	// y ordenAntigua (con menor ID) para que tenga fecha más reciente (hace 1 hora).
	fechaPasada := time.Now().Add(-2 * time.Hour)
	fechaMasReciente := time.Now().Add(-1 * time.Hour)

	require.NoError(t, tx.Model(&models.Orden{}).Where("id_orden = ?", ordenReciente.IDOrden).
		Update("fecha_creacion", fechaPasada).Error)
	require.NoError(t, tx.Model(&models.Orden{}).Where("id_orden = ?", ordenAntigua.IDOrden).
		Update("fecha_creacion", fechaMasReciente).Error)

	compras, total, err := svc.ListMyPurchases(ctx, 110, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, compras, 2)

	// ordenAntigua debe quedar PRIMERA porque su fecha_creacion es más reciente (-1h vs -2h),
	// a pesar de tener un ID de orden menor. Si el orden fuera por ID DESC, fallaría aquí.
	assert.Equal(t, ordenAntigua.IDOrden, compras[0].IDOrden, "la orden con fecha más reciente debe salir primero aunque tenga menor ID")
	assert.Equal(t, ordenReciente.IDOrden, compras[1].IDOrden, "la orden con fecha más antigua debe salir después aunque tenga mayor ID")
}

func TestListOrders_SoftDelete_OrdenEliminadaNoAparece(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// 1. Crear 2 órdenes para el comprador 120
	oActiva, err := svc.CreateOrder(ctx, 120, 220, 61, 10000)
	require.NoError(t, err)
	oParaBorrar, err := svc.CreateOrder(ctx, 120, 221, 62, 20000)
	require.NoError(t, err)

	// 2. Eliminar una de las órdenes con Delete de GORM (Soft delete)
	require.NoError(t, tx.Delete(&oParaBorrar).Error)

	// 3. Consultar compras del comprador 120
	compras, total, err := svc.ListMyPurchases(ctx, 120, 1, 10, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "el total de registros activos debe ser 1")
	require.Len(t, compras, 1, "solo debe retornar la orden activa que no fue borrada")
	assert.Equal(t, oActiva.IDOrden, compras[0].IDOrden)

	// 4. Verificar que la orden eliminada no es accesible en búsquedas normales pero sigue en BD
	var ordenVerificacion models.Orden
	errFind := tx.First(&ordenVerificacion, oParaBorrar.IDOrden).Error
	assert.ErrorIs(t, errFind, gorm.ErrRecordNotFound, "consulta normal no debe encontrar el registro con soft-delete")

	errUnscoped := tx.Unscoped().First(&ordenVerificacion, oParaBorrar.IDOrden).Error
	require.NoError(t, errUnscoped, "unscoped sí debe encontrar el registro en la base de datos")
	assert.True(t, ordenVerificacion.DeletedAt.Valid, "la columna deleted_at debe estar marcada como válida")
}

func TestListOrders_UsuarioSinOrdenes_RetornaSliceVacioYTotalCero(t *testing.T) {
	tx := setupOrderTestDB(t)
	svc := NewOrderService(tx)
	ctx := context.Background()

	// Usuario 99999 que no tiene compras ni ventas
	compras, totalCompras, errCompras := svc.ListMyPurchases(ctx, 99999, 1, 10, nil)
	assert.NoError(t, errCompras)
	assert.Equal(t, int64(0), totalCompras)
	assert.NotNil(t, compras, "el slice no debe ser nil para evitar TypeError en el frontend")
	assert.Empty(t, compras)

	ventas, totalVentas, errVentas := svc.ListMySales(ctx, 99999, 1, 10, nil)
	assert.NoError(t, errVentas)
	assert.Equal(t, int64(0), totalVentas)
	assert.NotNil(t, ventas, "el slice no debe ser nil para evitar TypeError en el frontend")
	assert.Empty(t, ventas)
}
