package service

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	publicationpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

// transicionesValidas define la máquina de estados finita (FSM) de una orden.
// Clave: estado actual. Valor: lista de estados a los que se permite transicionar.
var transicionesValidas = map[string][]string{
	models.EstadoOrdenPendiente:  {models.EstadoOrdenAceptada, models.EstadoOrdenCancelada},
	models.EstadoOrdenAceptada:   {models.EstadoOrdenCompletada, models.EstadoOrdenCancelada},
	models.EstadoOrdenCompletada: {}, // Estado final: inmutable
	models.EstadoOrdenCancelada:  {}, // Estado final: inmutable
}

// catalogCallTimeout limita la espera a Catálogo para no bloquear la creación de órdenes.
const catalogCallTimeout = 3 * time.Second

// PublicationGetter es el contrato mínimo que Órdenes necesita de Catálogo (ALL-141).
// Lo satisface publicationpb.PublicationServiceClient.
type PublicationGetter interface {
	GetPublication(ctx context.Context, in *publicationpb.GetPublicationRequest, opts ...grpc.CallOption) (*publicationpb.GetPublicationResponse, error)
}

// OrderService encapsula la conexión a la base de datos para las operaciones de órdenes.
type OrderService struct {
	db            *gorm.DB
	catalogClient PublicationGetter
}

// NewOrderService crea una instancia del servicio de órdenes con la conexión recibida.
func NewOrderService(db *gorm.DB, catalogClient ...PublicationGetter) *OrderService {
	svc := &OrderService{db: db}
	if len(catalogClient) > 0 {
		svc.catalogClient = catalogClient[0]
	}
	return svc
}

// CreateOrder valida y persiste una nueva orden en estado PENDIENTE (ALL-76).
func (s *OrderService) CreateOrder(ctx context.Context, compradorID, vendedorID, publicacionID uint, precio int64) (*models.Orden, error) {
	// Validaciones de negocio en función pura (antes de tocar la BD)
	if err := validateCreateOrder(compradorID, vendedorID, publicacionID, precio); err != nil {
		return nil, err
	}

	if s.db == nil {
		return nil, status.Error(codes.Unavailable, "base de datos no disponible")
	}

	// Contrastar con la publicación real de Catálogo (ALL-141)
	if err := s.verifyPublication(ctx, compradorID, vendedorID, publicacionID, precio); err != nil {
		return nil, err
	}

	// Verificar que no exista una orden activa duplicada
	var count int64
	if err := s.db.WithContext(ctx).Model(&models.Orden{}).
		Where("id_usuario_comprador = ? AND id_publicacion = ? AND estado IN ?",
			compradorID, publicacionID,
			[]string{models.EstadoOrdenPendiente, models.EstadoOrdenAceptada}).
		Count(&count).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al verificar órdenes existentes: %v", err)
	}
	if count > 0 {
		return nil, status.Error(codes.AlreadyExists, "ya tienes una orden en curso para esta publicación (RN-22)")
	}

	// Armar la orden con estado inicial explícito
	nuevaOrden := models.Orden{
		IDUsuarioComprador: compradorID,
		IDUsuarioVendedor:  vendedorID,
		IDPublicacion:      publicacionID,
		Estado:             models.EstadoOrdenPendiente,
		Precio:             precio,
	}

	// Guardar en la base de datos
	if err := s.db.WithContext(ctx).Create(&nuevaOrden).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al guardar la orden: %v", err)
	}

	return &nuevaOrden, nil
}

// PatchOrderStatus actualiza el estado de una orden aplicando autorización y validación de FSM 
func (s *OrderService) PatchOrderStatus(ctx context.Context, ordenID, usuarioID uint, nuevoEstado string) (*models.Orden, error) {
	// Validar que los IDs no vengan en cero (validación barata en memoria)
	if ordenID == 0 {
		return nil, status.Error(codes.InvalidArgument, "el id de la orden es obligatorio")
	}
	if usuarioID == 0 {
		return nil, status.Error(codes.InvalidArgument, "el id del usuario solicitante es obligatorio")
	}

	if s.db == nil {
		return nil, status.Error(codes.Unavailable, "base de datos no disponible")
	}

	// Buscar la orden existente por ID
	var orden models.Orden
	if err := s.db.WithContext(ctx).First(&orden, ordenID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, status.Error(codes.NotFound, "orden no encontrada")
		}
		return nil, status.Errorf(codes.Internal, "error al buscar la orden: %v", err)
	}

	// Autorización: verificar permisos según el rol en la orden
	if err := validateOrderPermissions(&orden, usuarioID, nuevoEstado); err != nil {
		return nil, err
	}

	// Validar la transición en la máquina de estados (FSM pura)
	estadoAnterior := orden.Estado
	if err := validateOrderTransition(estadoAnterior, nuevoEstado); err != nil {
		return nil, err
	}

	// Actualizar exclusivamente la columna estado con bloqueo optimista (evita condición de carrera)
	res := s.db.WithContext(ctx).Model(&orden).
		Where("estado = ?", estadoAnterior).
		Update("estado", nuevoEstado)
	if res.Error != nil {
		return nil, status.Errorf(codes.Internal, "error al actualizar el estado de la orden: %v", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, status.Error(codes.Aborted, "conflicto de concurrencia: el estado de la orden cambió antes de completar la operación")
	}

	orden.Estado = nuevoEstado
	return &orden, nil
}

// validateCreateOrder valida las reglas de negocio de creación (función pura).
func validateCreateOrder(compradorID, vendedorID, publicacionID uint, precio int64) error {
	if compradorID == 0 {
		return status.Error(codes.InvalidArgument, "el id del comprador es obligatorio")
	}
	if vendedorID == 0 {
		return status.Error(codes.InvalidArgument, "el id del vendedor es obligatorio")
	}
	if publicacionID == 0 {
		return status.Error(codes.InvalidArgument, "el id de la publicación es obligatorio")
	}
	if compradorID == vendedorID {
		return status.Error(codes.InvalidArgument, "el comprador no puede ser el mismo vendedor (RN-21)")
	}
	if precio <= 0 {
		return status.Error(codes.InvalidArgument, "el precio debe ser un entero mayor a 0 (RN-23)")
	}
	return nil
}

// verifyPublication contrasta vendedor y precio del request con la publicación real de Catálogo.
func (s *OrderService) verifyPublication(ctx context.Context, compradorID, vendedorID, publicacionID uint, precio int64) error {
	if s.catalogClient == nil {
		return status.Error(codes.Unavailable, "catálogo no disponible: cliente no configurado")
	}

	ctx, cancel := context.WithTimeout(ctx, catalogCallTimeout)
	defer cancel()

	resp, err := s.catalogClient.GetPublication(ctx, &publicationpb.GetPublicationRequest{IdPublicacion: uint32(publicacionID)})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return status.Error(codes.NotFound, "publicación no encontrada")
		}
		return status.Errorf(codes.Unavailable, "catálogo no disponible: %s", status.Code(err))
	}

	pub := resp.GetPublication()
	if pub == nil {
		return status.Error(codes.Unavailable, "respuesta inválida de catálogo")
	}
	if pub.GetEstado() != publicationpb.EstadoPublicacion_ACTIVO {
		return status.Error(codes.FailedPrecondition, "la publicación no está disponible para contratar")
	}

	vendedorReal := uint(pub.GetIdUsuarioVendedor())
	if compradorID == vendedorReal {
		return status.Error(codes.InvalidArgument, "el comprador no puede ser el mismo vendedor (RN-21)")
	}
	if vendedorID != vendedorReal {
		return status.Error(codes.InvalidArgument, "el vendedor indicado no coincide con el de la publicación")
	}
	if precio != pub.GetPrecioBase() {
		return status.Error(codes.InvalidArgument, "el precio indicado no coincide con el de la publicación")
	}
	return nil
}

// validateOrderTransition valida que el nuevo estado sea conocido y que la transición esté permitida (FSM pura).
func validateOrderTransition(estadoActual, nuevoEstado string) error {
	// Verificar que el estado solicitado exista en el dominio usando el mapa como fuente única
	if _, ok := transicionesValidas[nuevoEstado]; !ok {
		return status.Errorf(codes.InvalidArgument, "estado de orden desconocido: %s", nuevoEstado)
	}

	destinosValidos, ok := transicionesValidas[estadoActual]
	if !ok {
		return status.Errorf(codes.FailedPrecondition, "el estado actual '%s' no es válido en el sistema", estadoActual)
	}

	if slices.Contains(destinosValidos, nuevoEstado) {
		return nil
	}

	return status.Errorf(codes.FailedPrecondition, "transición no permitida: no se puede pasar de %s a %s", estadoActual, nuevoEstado)
}

// validateOrderPermissions valida que el usuario que solicita la acción tenga el rol adecuado sobre la orden.
func validateOrderPermissions(orden *models.Orden, usuarioID uint, nuevoEstado string) error {
	esComprador := orden.IDUsuarioComprador == usuarioID
	esVendedor := orden.IDUsuarioVendedor == usuarioID

	if !esComprador && !esVendedor {
		return status.Error(codes.PermissionDenied, "no tienes autorización para modificar esta orden")
	}

	// Solo el vendedor puede aceptar una solicitud/orden (para COMPLETADA y CANCELADA ambas partes están autorizadas)
	if nuevoEstado == models.EstadoOrdenAceptada && !esVendedor {
		return status.Error(codes.PermissionDenied, "solo el vendedor puede aceptar la orden")
	}

	return nil
}

// ============================================================================
// FUNCIONES Y MÉTODOS PARA GET ÓRDENES (ALL-78)
// ============================================================================

// Columnas de BD para consultas de listado
const (
	columnaComprador = "id_usuario_comprador"
	columnaVendedor  = "id_usuario_vendedor"
)

// ListMyPurchases retorna las compras realizadas por el usuario paginadas y filtradas opcionalmente por estado.
func (s *OrderService) ListMyPurchases(ctx context.Context, compradorID uint, page, limit int32, estado *string) ([]models.Orden, int64, error) {
	return s.listOrdersByUser(ctx, columnaComprador, compradorID, page, limit, estado)
}

// ListMySales retorna las ventas del usuario paginadas y filtradas opcionalmente por estado.
func (s *OrderService) ListMySales(ctx context.Context, vendedorID uint, page, limit int32, estado *string) ([]models.Orden, int64, error) {
	return s.listOrdersByUser(ctx, columnaVendedor, vendedorID, page, limit, estado)
}

// listOrdersByUser encapsula la lógica compartida de consulta para compras y ventas.
func (s *OrderService) listOrdersByUser(ctx context.Context, columna string, usuarioID uint, page, limit int32, estado *string) ([]models.Orden, int64, error) {
	// 1. Si el ID de usuario es 0, devolver codes.Unauthenticated
	if usuarioID == 0 {
		return nil, 0, status.Error(codes.Unauthenticated, "usuario no autenticado o ID inválido")
	}

	if columna != columnaComprador && columna != columnaVendedor {
		return nil, 0, status.Errorf(codes.Internal, "columna de consulta no permitida: %s", columna)
	}

	// 2. Normalizar paginación (se conserva el retorno de página por contrato de tests y futuro PaginationMeta)
	_, limitNorm, offset := normalizePagination(page, limit)

	// 3. Validar estado: recortar una sola vez al inicio y evaluar
	var estadoLimpio string
	if estado != nil {
		estadoLimpio = strings.TrimSpace(*estado)
	}
	if err := validateOrderFilterState(estadoLimpio); err != nil {
		return nil, 0, err
	}

	if s.db == nil {
		return nil, 0, status.Error(codes.Unavailable, "base de datos no disponible")
	}

	// 4. Consulta base con filtros: columna de usuario y estado (si aplica)
	baseQuery := s.db.WithContext(ctx).
		Model(&models.Orden{}).
		Where(columna+" = ?", usuarioID)

	if estadoLimpio != "" {
		baseQuery = baseQuery.Where("estado = ?", estadoLimpio)
	}

	// 5. Contar total antes de paginar. Se usa Session(&gorm.Session{}) sobre la consulta
	// ya filtrada para aislar la mutación del Count de la posterior consulta de registros.
	var totalRecords int64
	if err := baseQuery.Session(&gorm.Session{}).Count(&totalRecords).Error; err != nil {
		return nil, 0, status.Errorf(codes.Internal, "error al contar órdenes: %v", err)
	}

	if totalRecords == 0 {
		return make([]models.Orden, 0), 0, nil
	}

	// 6. Traer página con orden descendente por fecha y fallback por id_orden
	ordenes := make([]models.Orden, 0)
	if err := baseQuery.
		Order("fecha_creacion DESC, id_orden DESC").
		Offset(offset).
		Limit(int(limitNorm)).
		Find(&ordenes).Error; err != nil {
		return nil, 0, status.Errorf(codes.Internal, "error al listar órdenes: %v", err)
	}

	// 7. Retornar resultados (slice no nil y total de registros)
	return ordenes, totalRecords, nil
}

// normalizePagination ajusta page y limit dentro de rangos válidos y calcula el offset.
func normalizePagination(page, limit int32) (int32, int32, int) {
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}
	// Conversión a int antes de multiplicar para evitar desbordamiento en int32 con páginas muy altas
	offset := (int(page) - 1) * int(limit)
	return page, limit, offset
}

// validateOrderFilterState valida que el estado filtrado pertenezca al dominio de órdenes.
func validateOrderFilterState(estado string) error {
	if estado == "" {
		return nil
	}
	if _, ok := transicionesValidas[estado]; !ok {
		return status.Errorf(codes.InvalidArgument, "estado de orden inválido: %s", estado)
	}
	return nil
}