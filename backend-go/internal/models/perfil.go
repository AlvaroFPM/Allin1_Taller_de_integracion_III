// internal/models/perfil.go
package models

import "time"

type Perfil struct {
	IDPerfil         uint      `gorm:"primaryKey;column:id_perfil;autoIncrement"`
	IDUsuario        uint      `gorm:"column:id_usuario;uniqueIndex;not null"`
	Usuario          Usuario   `gorm:"foreignKey:IDUsuario;references:IDUsuario;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	BioExperiencia   string    `gorm:"column:bio_experiencia;type:text"`
	Telefono         string    `gorm:"column:telefono;type:varchar(20)"`
	Habilidades      string    `gorm:"column:habilidades;type:text"`
	Ciudad           string    `gorm:"column:ciudad;type:varchar(100)"`
	Region           string    `gorm:"column:region;type:varchar(100)"`
	FotoPerfilURL    string    `gorm:"column:foto_perfil_url;type:varchar(255)"`
	FechaCreacion    time.Time `gorm:"column:fecha_creacion;autoCreateTime"`
	FechaActualizado time.Time `gorm:"column:fecha_actualizado;autoUpdateTime"`
}

func (Perfil) TableName() string {
	return "perfiles"
}