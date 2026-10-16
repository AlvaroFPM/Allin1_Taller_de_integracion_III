package service

import (
	"context"
	"errors"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
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

// OrderService encapsula la conexión a la base de datos para las operaciones de órdenes.
type OrderService struct {
	db *gorm.DB
}

// NewOrderService crea una instancia del servicio de órdenes con la conexión recibida.
func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{db: db}
}

// CreateOrder valida y persiste una nueva orden en estado PENDIENTE (ALL-76).
func (s *OrderService) CreateOrder(ctx context.Context, compradorID, vendedorID, publicacionID uint, precio int64) (*models.Orden, error) {
	// Validaciones de negocio en función pura (antes de tocar la BD)
	if err := validateCreateOrder(compradorID, vendedorID, publicacionID, precio); err != nil {
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

// validateOrderTransition valida que el nuevo estado sea conocido y que la transición esté permitida (FSM pura).
func validateOrderTransition(estadoActual, nuevoEstado string) error {
	// Verificar que el estado solicitado sea válido en el dominio
	switch nuevoEstado {
	case models.EstadoOrdenPendiente, models.EstadoOrdenAceptada, models.EstadoOrdenCompletada, models.EstadoOrdenCancelada:
	default:
		return status.Errorf(codes.InvalidArgument, "estado de orden desconocido: %s", nuevoEstado)
	}

	// Verificar transiciones según el mapa
	destinosValidos, ok := transicionesValidas[estadoActual]
	if !ok {
		return status.Errorf(codes.FailedPrecondition, "el estado actual '%s' no es válido en el sistema", estadoActual)
	}

	for _, permitida := range destinosValidos {
		if permitida == nuevoEstado {
			return nil
		}
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