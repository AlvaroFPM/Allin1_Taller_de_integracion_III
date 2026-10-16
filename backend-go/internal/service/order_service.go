package service

import (
	"context"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type OrderService struct {
	db *gorm.DB
}

func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{db: db}
}

func (s *OrderService) CreateOrder(ctx context.Context, compradorID, vendedorID, publicacionID uint, precio int64) (*models.Orden, error) {
	if err := validateCreateOrder(compradorID, vendedorID, publicacionID, precio); err != nil {
		return nil, err
	}

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

	nuevaOrden := models.Orden{
		IDUsuarioComprador: compradorID,
		IDUsuarioVendedor:  vendedorID,
		IDPublicacion:      publicacionID,
		Estado:             models.EstadoOrdenPendiente,
		Precio:             precio,
	}

	if err := s.db.WithContext(ctx).Create(&nuevaOrden).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al guardar la orden: %v", err)
	}

	return &nuevaOrden, nil
}

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