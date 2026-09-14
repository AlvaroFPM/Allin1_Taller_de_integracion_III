package main

import (
	"fmt"
	"log"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
)

func main() {
	fmt.Println("Iniciando microservicio Catalog...")
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