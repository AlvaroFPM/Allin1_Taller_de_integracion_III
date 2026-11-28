package models

import "time"

// OrderExtra almacena metadatos opcionales del flujo de contratación (notas,
// fecha/horario acordado y confirmación previa de entrega por parte del vendedor).
type OrderExtra struct {
	IDOrden                 uint       `gorm:"primaryKey;column:id_orden" json:"idOrden"`
	Notas                   string     `gorm:"type:text;column:notas;default:''" json:"notas"`
	FechaAcordada           string     `gorm:"type:varchar(120);column:fecha_acordada;default:''" json:"fechaAcordada"`
	VendedorConfirmoEntrega bool       `gorm:"column:vendedor_confirmo_entrega;not null;default:false" json:"vendedorConfirmoEntrega"`
	FechaEntregaVendedor    *time.Time `gorm:"column:fecha_entrega_vendedor" json:"fechaEntregaVendedor,omitempty"`
	UpdatedAt               time.Time  `gorm:"column:fecha_actualizacion;autoUpdateTime" json:"updatedAt"`
}

func (OrderExtra) TableName() string {
	return "order_extras"
}

// OrderReview almacena la calificación real de un comprador tras completar una orden.
type OrderReview struct {
	IDReview          uint      `gorm:"primaryKey;column:id_review;autoIncrement" json:"idReview"`
	IDOrden           uint      `gorm:"column:id_orden;not null;uniqueIndex" json:"idOrden"`
	IDPublicacion     uint      `gorm:"column:id_publicacion;not null;index" json:"idPublicacion"`
	IDUsuarioAutor    uint      `gorm:"column:id_usuario_autor;not null;index" json:"idUsuarioAutor"`
	IDUsuarioEvaluado uint      `gorm:"column:id_usuario_evaluado;not null;index" json:"idUsuarioEvaluado"`
	Rating            int       `gorm:"column:rating;not null" json:"rating"`
	Comentario        string    `gorm:"type:text;column:comentario;default:''" json:"comentario"`
	CreatedAt         time.Time `gorm:"column:fecha_creacion;autoCreateTime" json:"createdAt"`
}

func (OrderReview) TableName() string {
	return "order_reviews"
}

