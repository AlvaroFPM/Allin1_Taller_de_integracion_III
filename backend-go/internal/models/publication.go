package models

import (
	"time"

	"gorm.io/gorm"
)
const (
	TipoOferta  = "OFERTA"
	TipoDemanda = "DEMANDA"
)

const (
	EstadoActivo     = "ACTIVO"
	EstadoPausado    = "PAUSADO"
	EstadoCompletado = "COMPLETADO"
	EstadoEliminado  = "ELIMINADO"
)

// Categoria mapea la tabla 'categorias' en PostgreSQL
type Categoria struct {
	IDCategoria uint      `gorm:"primaryKey;column:id_categoria;autoIncrement" json:"id_categoria"`
	Nombre      string    `gorm:"type:varchar(100);not null;unique" json:"nombre"`
	Slug        string    `gorm:"type:varchar(120);not null;unique" json:"slug"`
	IconoURL    *string   `gorm:"type:varchar(255);column:icono_url" json:"icono_url"`
	CreatedAt   time.Time `gorm:"column:fecha_creacion;autoCreateTime" json:"fecha_creacion"`
}

func (Categoria) TableName() string {
	return "categorias"
}

// Publicacion mapea la tabla 'publicaciones' en PostgreSQL
type Publicacion struct {
	IDPublicacion     uint           `gorm:"primaryKey;column:id_publicacion;autoIncrement" json:"id_publicacion"`
	IDUsuarioVendedor uint           `gorm:"column:id_usuario_vendedor;not null;index" json:"id_usuario_vendedor"`
	CategoriaID       uint           `gorm:"column:id_categoria;not null;index" json:"id_categoria"`
	Titulo            string         `gorm:"type:varchar(200);not null" json:"titulo"`
	Descripcion       string         `gorm:"type:text;not null" json:"descripcion"`
	TipoServicio      string         `gorm:"type:varchar(50);default:'OFERTA'" json:"tipo_servicio"`
	PrecioBase        int64          `gorm:"type:bigint;not null" json:"precio_base"` // RN-23: Entero positivo en CLP
	Ciudad            string         `gorm:"type:varchar(100);not null" json:"ciudad"`
	Region            string         `gorm:"type:varchar(100);not null" json:"region"`
	Estado            string         `gorm:"type:varchar(30);default:'ACTIVO'" json:"estado"`
	CreatedAt         time.Time      `gorm:"column:fecha_creacion;autoCreateTime" json:"fecha_creacion"`
	UpdatedAt         time.Time      `gorm:"column:fecha_actualizacion;autoUpdateTime" json:"fecha_actualizacion"`
	DeletedAt         gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"`

	// Relacion belongs-to: CategoriaID apunta a Categoria.IDCategoria
	Categoria Categoria `gorm:"foreignKey:CategoriaID;references:IDCategoria;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"categoria,omitempty"`
}

func (Publicacion) TableName() string {
	return "publicaciones"
}