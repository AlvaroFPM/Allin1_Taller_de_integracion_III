package main

import (
	"fmt"
	"log"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	dsn := "host=localhost user=postgres password=postgres dbname=catalog_db port=5434 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Error al conectar a la base de datos: %v", err)
	}

	DB = db
	fmt.Println("¡Conexión a PostgreSQL (catalog_db) exitosa!")
}

// MigrateTables ejecuta la creación automática de tablas en Postgres
func MigrateTables() {
	err := DB.AutoMigrate(
		&models.Categoria{},
		&models.Publicacion{},
	)
	if err != nil {
		log.Fatalf("Fallo en la migración de tablas: %v", err)
	}
	fmt.Println(" Migración completada: Tablas 'categorias' y 'publicaciones' creadas/sincronizadas en PostgreSQL.")
}

func main() {
	ConnectDB()
	MigrateTables()
}