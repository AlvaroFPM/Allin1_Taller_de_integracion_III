package database

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB es la instancia global de la base de datos
var DB *gorm.DB

// ConnectDB inicializa la conexión con PostgreSQL
func ConnectDB() {
	// DSN configurado para el puerto 5434 (catalog_db) según tu docker-compose.yml
	dsn := "host=localhost user=postgres password=postgres dbname=catalog_db port=5434 sslmode=disable"
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Error al conectar a la base de datos: %v", err)
	}

	DB = db
	fmt.Println("¡Conexión a PostgreSQL (catalog_db) exitosa!")
}
