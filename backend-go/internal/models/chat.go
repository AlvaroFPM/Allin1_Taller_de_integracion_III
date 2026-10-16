package models

import (
	"time"

	"gorm.io/gorm"
)

// ChatSala representa una conversación entre un comprador y un vendedor
type ChatSala struct {
	IDSala        uint           `gorm:"primaryKey;column:id_sala;autoIncrement" json:"id_sala"`
	CompradorID   uint           `gorm:"column:comprador_id;not null;index" json:"comprador_id"`
	VendedorID    uint           `gorm:"column:vendedor_id;not null;index" json:"vendedor_id"`
	PublicacionID *uint          `gorm:"column:publicacion_id;index" json:"publicacion_id,omitempty"`
	CreatedAt     time.Time      `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"`
}

func (ChatSala) TableName() string {
	return "chat_salas"
}

// ChatMensaje representa un mensaje individual dentro de una sala
type ChatMensaje struct {
	IDMensaje      uint           `gorm:"primaryKey;column:id_mensaje;autoIncrement" json:"id_mensaje"`
	SalaID         uint           `gorm:"column:sala_id;not null;index" json:"sala_id"`
	RemitenteID    uint           `gorm:"column:remitente_id;not null;index" json:"remitente_id"`
	DestinatarioID uint           `gorm:"column:destinatario_id;not null;index" json:"destinatario_id"`
	Contenido      string         `gorm:"type:text;not null" json:"contenido"`
	Leido          bool           `gorm:"default:false;not null" json:"leido"`
	CreatedAt      time.Time      `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"`
}

func (ChatMensaje) TableName() string {
	return "chat_mensajes"
}
