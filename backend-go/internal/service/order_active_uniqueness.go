package service

import (
	"errors"
	"fmt"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"gorm.io/gorm"
)

const (
	activeOrderIndexName            = "idx_ordenes_activa_unica"
	postgresUniqueViolationSQLState = "23505"
)

// EnsureActiveOrderUniqueIndex crea, de forma idempotente, el índice único parcial que
// impide dos órdenes activas del mismo comprador para la misma publicación (RN-22).
func EnsureActiveOrderUniqueIndex(db *gorm.DB) error {
	createIndexStatement := fmt.Sprintf(
		"CREATE UNIQUE INDEX IF NOT EXISTS %s ON ordenes (id_usuario_comprador, id_publicacion) "+
			"WHERE estado IN ('%s', '%s') AND deleted_at IS NULL",
		activeOrderIndexName, models.EstadoOrdenPendiente, models.EstadoOrdenAceptada)
	if err := db.Exec(createIndexStatement).Error; err != nil {
		return fmt.Errorf("no se pudo crear el índice %s (revisa si existen órdenes activas duplicadas): %w", activeOrderIndexName, err)
	}
	return nil
}

// isUniqueConstraintViolation detecta una violación de unicidad en PostgreSQL,
// con o sin TranslateError activo en la conexión de GORM.
func isUniqueConstraintViolation(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	var errorWithSQLState interface{ SQLState() string }
	return errors.As(err, &errorWithSQLState) && errorWithSQLState.SQLState() == postgresUniqueViolationSQLState
}
