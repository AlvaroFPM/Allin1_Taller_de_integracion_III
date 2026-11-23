package service

import (
	"context"
	"fmt"
	"os"
	"sync"
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

// simultaneousCreateRequests es la cantidad de CreateOrder que se disparan a la vez en cada ronda.
const simultaneousCreateRequests = 8

// createOrderOutcome guarda el resultado de una llamada a CreateOrder hecha dentro de una goroutine.
type createOrderOutcome struct {
	createdOrder *models.Orden
	err          error
}

// openOrdersIntegrationDB abre una conexión real a PostgreSQL, sin transacción envolvente,
// para que las goroutines usen conexiones distintas y la carrera sea real.
func openOrdersIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		getOrderTestEnv("DB_HOST", "localhost"),
		getOrderTestEnv("DB_USER", "catalog_user"),
		getOrderTestEnv("DB_PASSWORD", "catalog_password"),
		getOrderTestEnv("DB_NAME", "catalog_db"),
		getOrderTestEnv("DB_PORT", "5434"))

	orderDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("PostgreSQL local no disponible (%v). Levanta el contenedor postgres_catalog.", err)
	}
	require.NoError(t, orderDB.AutoMigrate(&models.Orden{}))

	var postgresServerVersion string
	require.NoError(t, orderDB.Raw("SELECT version()").Scan(&postgresServerVersion).Error)
	t.Logf("PostgreSQL: %s", postgresServerVersion)

	sqlConnectionPool, err := orderDB.DB()
	require.NoError(t, err)
	sqlConnectionPool.SetMaxOpenConns(simultaneousCreateRequests * 2)
	t.Cleanup(func() { _ = sqlConnectionPool.Close() })

	return orderDB
}

// deleteOrdersOfBuyer borra definitivamente (sin soft delete) las órdenes de un comprador de prueba.
func deleteOrdersOfBuyer(t *testing.T, orderDB *gorm.DB, compradorID uint) {
	t.Helper()
	require.NoError(t, orderDB.Unscoped().
		Where("id_usuario_comprador = ?", compradorID).
		Delete(&models.Orden{}).Error)
}

// countActiveOrdersPersisted cuenta las órdenes PENDIENTE o ACEPTADA realmente guardadas en PostgreSQL.
func countActiveOrdersPersisted(t *testing.T, orderDB *gorm.DB, compradorID, publicacionID uint) int64 {
	t.Helper()
	var activeOrdersPersisted int64
	require.NoError(t, orderDB.Model(&models.Orden{}).
		Where("id_usuario_comprador = ? AND id_publicacion = ? AND estado IN ?",
			compradorID, publicacionID,
			[]string{models.EstadoOrdenPendiente, models.EstadoOrdenAceptada}).
		Count(&activeOrdersPersisted).Error)
	return activeOrdersPersisted
}

// createOrderSimultaneously lanza simultaneousCreateRequests llamadas idénticas a CreateOrder
// y las libera a la vez con un canal barrera.
func createOrderSimultaneously(orderService *OrderService, compradorID, vendedorID, publicacionID uint, precio int64) []createOrderOutcome {
	startBarrier := make(chan struct{})
	createOrderOutcomes := make([]createOrderOutcome, simultaneousCreateRequests)

	var requestsFinished sync.WaitGroup
	for requestIndex := 0; requestIndex < simultaneousCreateRequests; requestIndex++ {
		requestsFinished.Add(1)
		go func(requestIndex int) {
			defer requestsFinished.Done()
			<-startBarrier
			createdOrder, err := orderService.CreateOrder(context.Background(), compradorID, vendedorID, publicacionID, precio)
			createOrderOutcomes[requestIndex] = createOrderOutcome{createdOrder: createdOrder, err: err}
		}(requestIndex)
	}

	close(startBarrier)
	requestsFinished.Wait()
	return createOrderOutcomes
}

// Regresión de ALL-153: con el índice único parcial, dos o más creaciones simultáneas del mismo
// comprador y publicación dejan una sola orden activa y el resto recibe el rechazo explícito de RN-22.
func TestCreateOrder_ConcurrentSameBuyerAndPublication_PersistsSingleActiveOrder(t *testing.T) {
	orderDB := openOrdersIntegrationDB(t)
	require.NoError(t, EnsureActiveOrderUniqueIndex(orderDB))

	const (
		compradorID   uint  = 990001
		vendedorID    uint  = 990002
		publicacionID uint  = 990003
		precio        int64 = 15000
	)
	deleteOrdersOfBuyer(t, orderDB, compradorID)
	t.Cleanup(func() { deleteOrdersOfBuyer(t, orderDB, compradorID) })

	orderService := NewOrderService(orderDB, newCatalogStub(activePub(uint32(publicacionID), uint32(vendedorID), precio)))
	createOrderOutcomes := createOrderSimultaneously(orderService, compradorID, vendedorID, publicacionID, precio)

	var successfulCreations, rejectedAsDuplicate, failedForOtherReasons int
	for _, outcome := range createOrderOutcomes {
		switch {
		case outcome.err == nil:
			successfulCreations++
		case status.Code(outcome.err) == codes.AlreadyExists:
			rejectedAsDuplicate++
			assert.Equal(t, mensajeOrdenActivaDuplicada, status.Convert(outcome.err).Message())
		default:
			failedForOtherReasons++
			t.Logf("fallo inesperado: %v", outcome.err)
		}
	}

	assert.Equal(t, 1, successfulCreations, "debe crearse exactamente una orden")
	assert.Equal(t, simultaneousCreateRequests-1, rejectedAsDuplicate, "el resto debe recibir AlreadyExists (RN-22)")
	assert.Equal(t, 0, failedForOtherReasons, "ningún rechazo debe llegar como error interno")
	assert.Equal(t, int64(1), countActiveOrdersPersisted(t, orderDB, compradorID, publicacionID))
}

// Prueba de registro (no es regresión): sin el índice, mide cuántas órdenes activas quedan
// persistidas por ronda. Solo corre con ORDERS_RECORD_RACE_WITHOUT_INDEX definida, porque
// elimina el índice de la base y no afirma un resultado: la carrera no es determinista.
func TestCreateOrder_ConcurrentWithoutUniqueIndex_RecordsPersistedDuplicates(t *testing.T) {
	if os.Getenv("ORDERS_RECORD_RACE_WITHOUT_INDEX") == "" {
		t.Skip("prueba de registro: defina ORDERS_RECORD_RACE_WITHOUT_INDEX=1 para ejecutarla")
	}

	orderDB := openOrdersIntegrationDB(t)
	require.NoError(t, orderDB.Exec("DROP INDEX IF EXISTS "+activeOrderIndexName).Error)

	const (
		roundsWithoutIndex       = 5
		firstCompradorID   uint  = 990100
		vendedorID         uint  = 990002
		publicacionID      uint  = 990003
		precio             int64 = 15000
	)
	orderService := NewOrderService(orderDB, newCatalogStub(activePub(uint32(publicacionID), uint32(vendedorID), precio)))

	for roundNumber := 0; roundNumber < roundsWithoutIndex; roundNumber++ {
		compradorID := firstCompradorID + uint(roundNumber)
		deleteOrdersOfBuyer(t, orderDB, compradorID)
		t.Cleanup(func() { deleteOrdersOfBuyer(t, orderDB, compradorID) })

		createOrderOutcomes := createOrderSimultaneously(orderService, compradorID, vendedorID, publicacionID, precio)

		successfulCreations := 0
		for _, outcome := range createOrderOutcomes {
			if outcome.err == nil {
				successfulCreations++
			}
		}
		t.Logf("ronda %d: creaciones exitosas=%d, órdenes activas persistidas=%d",
			roundNumber+1, successfulCreations, countActiveOrdersPersisted(t, orderDB, compradorID, publicacionID))
	}
}

// Regresión de ALL-153: si el estado cambia entre la lectura y la actualización, PatchOrderStatus
// devuelve Aborted y no sobrescribe el cambio ya aplicado. La lectura obsoleta se fuerza con un
// callback de GORM registrado solo en la prueba: tras el First del servicio, otra conexión cancela la orden.
func TestPatchOrderStatus_StaleStateDoesNotOverwriteConcurrentChange(t *testing.T) {
	serviceDB := openOrdersIntegrationDB(t)
	concurrentWriterDB := openOrdersIntegrationDB(t)

	const (
		compradorID   uint  = 990201
		vendedorID    uint  = 990202
		publicacionID uint  = 990203
		precio        int64 = 15000
	)
	deleteOrdersOfBuyer(t, serviceDB, compradorID)
	t.Cleanup(func() { deleteOrdersOfBuyer(t, serviceDB, compradorID) })

	pendingOrder := models.Orden{
		IDUsuarioComprador: compradorID,
		IDUsuarioVendedor:  vendedorID,
		IDPublicacion:      publicacionID,
		Estado:             models.EstadoOrdenPendiente,
		Precio:             precio,
	}
	require.NoError(t, serviceDB.Create(&pendingOrder).Error)

	var cancelAfterReadOnce sync.Once
	require.NoError(t, serviceDB.Callback().Query().After("gorm:query").Register("test:cancel_order_after_read",
		func(queryTx *gorm.DB) {
			if queryTx.Statement.Table != "ordenes" {
				return
			}
			cancelAfterReadOnce.Do(func() {
				cancelResult := concurrentWriterDB.Exec(
					"UPDATE ordenes SET estado = ? WHERE id_orden = ?",
					models.EstadoOrdenCancelada, pendingOrder.IDOrden)
				if cancelResult.Error != nil {
					queryTx.AddError(cancelResult.Error)
				}
			})
		}))

	orderService := NewOrderService(serviceDB)
	_, err := orderService.PatchOrderStatus(context.Background(), pendingOrder.IDOrden, vendedorID, models.EstadoOrdenAceptada)

	require.Error(t, err)
	assert.Equal(t, codes.Aborted, status.Code(err))

	var persistedOrder models.Orden
	require.NoError(t, concurrentWriterDB.First(&persistedOrder, pendingOrder.IDOrden).Error)
	assert.Equal(t, models.EstadoOrdenCancelada, persistedOrder.Estado, "el estado ya aplicado no debe ser sobrescrito")
}

// Regresión de ALL-153: el índice único parcial solo cubre órdenes activas. Una orden CANCELADA o
// COMPLETADA no bloquea una nueva, y la nueva orden activa vuelve a quedar protegida contra duplicados.
func TestCreateOrder_AfterCancelledOrCompletedOrder_AllowsNewActiveOrderWithIndexPresent(t *testing.T) {
	orderDB := openOrdersIntegrationDB(t)
	require.NoError(t, EnsureActiveOrderUniqueIndex(orderDB))

	const (
		compradorID   uint  = 990401
		vendedorID    uint  = 990402
		publicacionID uint  = 990403
		precio        int64 = 15000
	)
	deleteOrdersOfBuyer(t, orderDB, compradorID)
	t.Cleanup(func() { deleteOrdersOfBuyer(t, orderDB, compradorID) })

	orderService := NewOrderService(orderDB, newCatalogStub(activePub(uint32(publicacionID), uint32(vendedorID), precio)))
	ctx := context.Background()

	orderToCancel, err := orderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)
	require.NoError(t, err)
	_, err = orderService.PatchOrderStatus(ctx, orderToCancel.IDOrden, compradorID, models.EstadoOrdenCancelada)
	require.NoError(t, err)

	orderToComplete, err := orderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)
	require.NoError(t, err, "una orden CANCELADA no debe bloquear una nueva")
	_, err = orderService.PatchOrderStatus(ctx, orderToComplete.IDOrden, vendedorID, models.EstadoOrdenAceptada)
	require.NoError(t, err)
	_, err = orderService.PatchOrderStatus(ctx, orderToComplete.IDOrden, compradorID, models.EstadoOrdenCompletada)
	require.NoError(t, err)

	currentActiveOrder, err := orderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)
	require.NoError(t, err, "una orden COMPLETADA no debe bloquear una nueva")
	assert.Equal(t, models.EstadoOrdenPendiente, currentActiveOrder.Estado)

	_, err = orderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)
	require.Error(t, err)
	assert.Equal(t, codes.AlreadyExists, status.Code(err))

	var ordersPersistedForBuyer int64
	require.NoError(t, orderDB.Model(&models.Orden{}).
		Where("id_usuario_comprador = ?", compradorID).
		Count(&ordersPersistedForBuyer).Error)
	assert.Equal(t, int64(3), ordersPersistedForBuyer, "las tres órdenes (CANCELADA, COMPLETADA y la activa) deben conservarse")
	assert.Equal(t, int64(1), countActiveOrdersPersisted(t, orderDB, compradorID, publicacionID))
}
