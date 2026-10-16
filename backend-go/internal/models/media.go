// internal/models/media.go
package models

import "time"

// Tipos de imagen que Media puede registrar.
const (
	TipoMediaPerfil  = "PERFIL"
	TipoMediaPortada = "PORTADA"
)

// Media guarda la referencia a una imagen subida a Cloudinary.
type Media struct {
	IDMedia       uint      `gorm:"primaryKey;column:id_media;autoIncrement"`
	IDUsuario     uint      `gorm:"column:id_usuario;not null;index:idx_media_usuario_tipo"`
	Tipo          string    `gorm:"column:tipo;type:varchar(20);not null;index:idx_media_usuario_tipo"`
	URL           string    `gorm:"column:url;type:varchar(500);not null"`
	PublicID      string    `gorm:"column:public_id;type:varchar(255);not null;uniqueIndex"`
	FechaCreacion time.Time `gorm:"column:fecha_creacion;autoCreateTime"`
}

func (Media) TableName() string {
	return "media"
}

type FileInfo struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	URL      string `json:"url"`
	PublicID string `json:"publicId,omitempty"`
}

type UploadResult struct {
	Success bool       `json:"success"`
	Files   []FileInfo `json:"files"`
}
	