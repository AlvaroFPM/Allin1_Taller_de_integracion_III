package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	publicationpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/seed"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	fmt.Println("Iniciando microservicio Catalog...")
	db, err := database.ConnectDB()
	if err != nil {
		log.Fatalf("Error al conectar a la base de datos en Catalog: %v", err)
	}

	// Ejecutar AutoMigrate
	err = database.DB.AutoMigrate(
		&models.Categoria{},
		&models.Publicacion{},
	)
	if err != nil {
		log.Fatalf("Error al migrar tablas de Catalog: %v", err)
	}
	fmt.Println(" Migracion exitosa: Tablas 'categorias' y 'publicaciones' (con deleted_at) sincronizadas.")

	// Seed de datos de demo (solo inserta si la base está vacía)
	if err := seed.SeedIfEmpty(database.DB); err != nil {
		log.Printf("Advertencia al ejecutar seed de Catalog: %v", err)
	}

	// Configurar puertos
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50052"
	}
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8082"
	}

	// 1. Iniciar Servidor gRPC
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Fallo al escuchar en puerto %s: %v", grpcPort, err)
	}

	grpcServer := grpc.NewServer()
	catalogService := service.NewPublicationServiceServer(db)
	publicationpb.RegisterPublicationServiceServer(grpcServer, catalogService)
	reflection.Register(grpcServer)

	go func() {
		fmt.Printf("Servidor gRPC de Catalog escuchando en el puerto %s...\n", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Fallo al iniciar servidor gRPC: %v", err)
		}
	}()

	// 2. Iniciar Servidor REST (gRPC-Gateway)
	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithInsecure()}

	err = publicationpb.RegisterPublicationServiceHandlerFromEndpoint(context.Background(), mux, "localhost:"+grpcPort, opts)
	if err != nil {
		log.Fatalf("Fallo al registrar gRPC-Gateway: %v", err)
	}

	// Configurar CORS
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}).Handler(mux)

	fmt.Printf("Servidor REST (gRPC-Gateway) de Catalog escuchando en el puerto %s...\n", httpPort)
	if err := http.ListenAndServe(":"+httpPort, handler); err != nil {
		log.Fatalf("Fallo al iniciar el servidor HTTP: %v", err)
	}
}
