package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB es la instancia global de la base de datos
var DB *gorm.DB

// ConnectDB inicializa la conexión con PostgreSQL.
// Retorna el error en vez de terminar el proceso, para que cada
// microservicio decida si la falta de DB es crítica o no.
func ConnectDB() (*gorm.DB, error) {
	// DSN configurado para el puerto 5434 (catalog_db) según tu docker-compose.yml
	dsn := "host=localhost user=postgres password=postgres dbname=catalog_db port=5434 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("error al conectar a la base de datos: %w", err)
	}

	DB = db
	fmt.Println("¡Conexión a PostgreSQL (catalog_db) exitosa!")
	return db, nil
}