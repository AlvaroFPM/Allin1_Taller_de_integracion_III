package main

import (
	"fmt"
	"log"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
)

func main() {
	fmt.Println("Iniciando microservicio Catalog...")
	// TODO: ConnectDB() devuelve (*gorm.DB, error) intencionalmente para no
	// terminar el proceso automáticamente. Este código actualmente ignora el
	// error retornado, lo que causa un panic (nil pointer dereference) si la
	// conexión a la base de datos falla. Falta manejar el error explícitamente
	// antes de usar el *gorm.DB retornado. Detectado en PR #117.
	database.ConnectDB()

	// Ejecutar AutoMigrate
	err := database.DB.AutoMigrate(
		&models.Categoria{},
		&models.Publicacion{},
	)
	if err != nil {
		log.Fatalf("Error al migrar tablas de Catalog: %v", err)
	}
	fmt.Println(" Migracion exitosa: Tablas 'categorias' y 'publicaciones' (con deleted_at) sincronizadas.")

	// TODO: Inicializar servidor gRPC y grpc-gateway para Catalog
}