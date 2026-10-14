package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	EstadoOrdenPendiente  = "PENDIENTE"
	EstadoOrdenAceptada   = "ACEPTADA"
	EstadoOrdenCompletada = "COMPLETADA"
	EstadoOrdenCancelada  = "CANCELADA"
)

type Orden struct {
	IDOrden            uint           `gorm:"primaryKey;column:id_orden;autoIncrement" json:"id_orden"`
	IDUsuarioComprador uint           `gorm:"column:id_usuario_comprador;not null;index" json:"id_usuario_comprador"` 
	IDUsuarioVendedor  uint           `gorm:"column:id_usuario_vendedor;not null;index" json:"id_usuario_vendedor"`   
	IDPublicacion      uint           `gorm:"column:id_publicacion;not null;index" json:"id_publicacion"`             
	Estado             string         `gorm:"type:varchar(30);default:'PENDIENTE';not null" json:"estado"`
	Precio             int64          `gorm:"type:bigint;not null" json:"precio"` 
	CreatedAt          time.Time      `gorm:"column:fecha_creacion;autoCreateTime" json:"fecha_creacion"`
	UpdatedAt          time.Time      `gorm:"column:fecha_actualizacion;autoUpdateTime" json:"fecha_actualizacion"`
	DeletedAt          gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"` 
}

func (Orden) TableName() string {
	return "ordenes"
}
