package models

import (
	"time"

	"gorm.io/gorm"
)

type Resena struct {
	IDResena     uint           `gorm:"primaryKey;column:id_resena;autoIncrement" json:"id_resena"`
	IDOrden      uint           `gorm:"column:id_orden;not null;uniqueIndex:idx_resena_orden_evaluador,priority:1" json:"id_orden"`
	IDEvaluador  uint           `gorm:"column:id_evaluador;not null;uniqueIndex:idx_resena_orden_evaluador,priority:2" json:"id_evaluador"`
	IDEvaluado   uint           `gorm:"column:id_evaluado;not null;index;check:id_evaluador <> id_evaluado" json:"id_evaluado"`
	Calificacion int            `gorm:"column:calificacion;not null;check:calificacion >= 1 AND calificacion <= 5" json:"calificacion"`
	Comentario   string         `gorm:"column:comentario;type:text;not null" json:"comentario"`
	CreatedAt    time.Time      `gorm:"column:fecha_creacion;autoCreateTime" json:"fecha_creacion"`
	UpdatedAt    time.Time      `gorm:"column:fecha_actualizacion;autoUpdateTime" json:"fecha_actualizacion"`
	DeletedAt    gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"`
}

func (Resena) TableName() string {
	return "resenas"
}
