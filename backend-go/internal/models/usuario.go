package models

import "time"

// Usuario representa la tabla USUARIOS del diagrama MER
type Usuario struct {
	IDUsuario     uint      `gorm:"primaryKey;column:id_usuario;autoIncrement"`
	Rut           string    `gorm:"column:rut;type:varchar(20);uniqueIndex;not null"`
	Nombres       string    `gorm:"column:nombres;type:varchar(100);not null"`
	Apellidos     string    `gorm:"column:apellidos;type:varchar(100);not null"`
	Correo        string    `gorm:"column:correo;type:varchar(150);uniqueIndex;not null"`
	PasswordHash  string    `gorm:"column:password_hash;type:varchar(255);not null"`
	Rol           string    `gorm:"column:rol;type:varchar(50);default:'CLIENTE'"`
	EstadoActivo  bool      `gorm:"column:estado_activo;default:true"`
	FechaCreacion time.Time `gorm:"column:fecha_creacion;autoCreateTime"`
}

func (Usuario) TableName() string {
	return "usuarios"
}
