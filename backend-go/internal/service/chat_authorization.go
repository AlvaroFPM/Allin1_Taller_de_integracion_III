package service

import (
	"context"
	"errors"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

// requireRoomParticipant comprueba que el usuario autenticado
// sea comprador o vendedor de una sala existente.
func (s *ChatServiceServer) requireRoomParticipant(
	ctx context.Context,
	salaID uint,
) (*models.ChatSala, error) {
	userID := extractUserID(ctx)
	if userID == 0 {
		return nil, status.Error(
			codes.Unauthenticated,
			"usuario no autenticado",
		)
	}

	if s.db == nil {
		return nil, status.Error(
			codes.Unavailable,
			"la base de datos de Chat no está disponible",
		)
	}

	var sala models.ChatSala
	err := s.db.WithContext(ctx).
		Where("id_sala = ?", salaID).
		First(&sala).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, status.Error(
			codes.NotFound,
			"la sala de chat no existe",
		)
	}
	if err != nil {
		return nil, status.Error(
			codes.Internal,
			"no se pudo comprobar el acceso a la sala",
		)
	}

	if userID != sala.CompradorID && userID != sala.VendedorID {
		return nil, status.Error(
			codes.PermissionDenied,
			"no tienes permiso para acceder a esta sala",
		)
	}

	return &sala, nil
}
