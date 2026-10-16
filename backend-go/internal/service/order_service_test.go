package service

import (
	"context"
	"fmt"
	"os"
	"testing"

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