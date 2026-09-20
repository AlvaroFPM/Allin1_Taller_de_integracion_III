package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/joho/godotenv"

	apiMedia "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/media"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	serviceMedia "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

func main() {
	fmt.Println("Iniciando microservicio Media...")

	if err := godotenv.Load(); err != nil {
		log.Println("No se encontró archivo .env, usando variables del sistema")
	}

	// TODO: ConnectDB() devuelve (*gorm.DB, error) intencionalmente para no
	// terminar el proceso automáticamente. Este código actualmente ignora el
	// error retornado, lo que causa un panic (nil pointer dereference) si la
	// conexión a la base de datos falla. Falta manejar el error explícitamente
	// antes de usar el *gorm.DB retornado. Detectado en PR #117.
	if _, err := database.ConnectDB(); err != nil {
		log.Printf("DB no disponible, continuando sin persistencia: %v", err)
	}

	uploadService, err := serviceMedia.NewUploadService()
	if err != nil {
		log.Fatalf("Error al inicializar servicio de uploads: %v", err)
	}
	uploadHandler := apiMedia.NewUploadHandler(uploadService)

	mux := http.NewServeMux()
	mux.HandleFunc("/upload/multiple", uploadHandler.Handle)

	port := ":8083"
	fmt.Printf("Servidor Media escuchando en %s\n", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Error al iniciar servidor: %v", err)
	}
}