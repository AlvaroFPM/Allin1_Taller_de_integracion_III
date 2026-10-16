package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

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

	if _, err := database.ConnectDB(); err != nil {
		log.Printf("DB no disponible, continuando sin persistencia: %v", err)
	}

	uploadService, err := serviceMedia.NewUploadService()
	if err != nil {
		log.Fatalf("Error al inicializar servicio de uploads: %v", err)
	}
	uploadHandler := apiMedia.NewUploadHandler(uploadService)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/upload/multiple", uploadHandler.Handle)

	port := os.Getenv("MEDIA_PORT")
	if port == "" {
		port = "8083"
	}
	addr := ":" + port
	fmt.Printf("Servidor Media escuchando en %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Error al iniciar servidor: %v", err)
	}
}