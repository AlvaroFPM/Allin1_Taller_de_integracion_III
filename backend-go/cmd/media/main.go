package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"github.com/rs/cors"
	"github.com/joho/godotenv"

	apiMedia "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/media"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	serviceMedia "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

func main() {
	fmt.Println("Iniciando microservicio Media...")

	if err := godotenv.Load(); err != nil {
		log.Println("No se encontró archivo .env, usando variables del sistema")
	}

	var repo serviceMedia.MediaRepository
	db, err := database.ConnectDB()
	if err != nil {
		log.Printf("DB no disponible, continuando sin persistencia: %v", err)
	} else {
		if err := db.AutoMigrate(&models.Media{}); err != nil {
			log.Fatalf("Error al migrar Media: %v", err)
		}
		fmt.Println("Migración de base de datos de Media completada.")
		repo = serviceMedia.NewGormMediaRepository(db)
	}

	uploadService, err := serviceMedia.NewUploadService()
	if err != nil {
		log.Fatalf("Error al inicializar servicio de uploads: %v", err)
	}
	uploadHandler := apiMedia.NewUploadHandler(uploadService)

	mediaService := serviceMedia.NewMediaService(uploadService, repo)
	mediaHandler := apiMedia.NewMediaHandler(mediaService)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/upload/multiple", uploadHandler.Handle)
	mux.Handle("/v1/media/upload", middleware.HTTPAuth(http.HandlerFunc(mediaHandler.Handle)))

		port := os.Getenv("MEDIA_PORT")
	if port == "" {
		port = "8083"
	}
	addr := ":" + port

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	})

	fmt.Printf("Servidor Media escuchando en %s\n", addr)
	if err := http.ListenAndServe(addr, c.Handler(mux)); err != nil {
		log.Fatalf("Error al iniciar servidor: %v", err)
	}
}