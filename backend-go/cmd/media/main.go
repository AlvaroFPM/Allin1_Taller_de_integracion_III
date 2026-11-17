package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/cors"

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

	// No iniciar con autenticacion de desarrollo ni almacenamiento incompleto.
	for _, name := range []string{"JWT_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"} {
		if strings.TrimSpace(os.Getenv(name)) == "" {
			log.Fatalf("Configuracion requerida ausente: %s", name)
		}
	}

	db, err := database.ConnectDB()
	if err != nil {
		log.Fatal("DB no disponible: Media no puede iniciar sin persistencia")
	}
	if err := db.AutoMigrate(&models.Media{}); err != nil {
		log.Fatal("No se pudo migrar la base de datos de Media")
	}
	fmt.Println("Migración de base de datos de Media completada.")
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("No se pudo obtener la conexion SQL de Media")
	}
	defer sqlDB.Close()
	repo := serviceMedia.NewGormMediaRepository(db)

	uploadService, err := serviceMedia.NewUploadService()
	if err != nil {
		log.Fatalf("Error al inicializar servicio de uploads: %v", err)
	}
	uploadHandler := apiMedia.NewUploadHandler(uploadService)

	mediaService := serviceMedia.NewMediaService(uploadService, repo)
	mediaHandler := apiMedia.NewMediaHandler(mediaService)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ctx); err != nil {
			http.Error(w, "base de datos no disponible", http.StatusServiceUnavailable)
			return
		}
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
	server := &http.Server{
		Addr:              addr,
		Handler:           c.Handler(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Error al iniciar servidor: %v", err)
	}
}
