package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"
)

func main() {
	fmt.Println("Iniciando microservicio IAM (Auth)...")

	// Conexión a la base de datos con manejo de error
	db, err := database.ConnectDB()
	if err != nil {
		log.Fatalf("No se pudo conectar a la base de datos: %v", err)
	}
	fmt.Println("Conexión a la base de datos exitosa.")
	_ = db // TODO: Pasar la instancia de DB al servicio cuando sea necesario

	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8080"
	}

	// 1. Configurar servidor gRPC
	grpcAddress := fmt.Sprintf(":%s", grpcPort)
	listener, err := net.Listen("tcp", grpcAddress)
	if err != nil {
		log.Fatalf("Error al intentar escuchar en el puerto %s: %v", grpcPort, err)
	}

	grpcServer := grpc.NewServer()
	authService := service.NewAuthService()
	auth.RegisterAuthServiceServer(grpcServer, authService)
	reflection.Register(grpcServer)

	// Ejecutar servidor gRPC en una goroutine
	go func() {
		log.Printf("Servidor gRPC de IAM (Auth) iniciado y escuchando en el puerto %s...\n", grpcPort)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("Error al iniciar el servidor gRPC: %v", err)
		}
	}()

	// 2. Configurar servidor HTTP (gRPC-Gateway)
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	// Conectar el gateway al servidor gRPC local
	err = auth.RegisterAuthServiceHandlerFromEndpoint(ctx, mux, "localhost"+grpcAddress, opts)
	if err != nil {
		log.Fatalf("Error al registrar el handler del gateway: %v", err)
	}

	// Configurar CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"}, // Permitir solo a Next.js por seguridad local
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	log.Printf("Servidor REST (gRPC-Gateway) iniciado y escuchando en el puerto %s...\n", httpPort)
	if err := http.ListenAndServe(":"+httpPort, handler); err != nil {
		log.Fatalf("Error al iniciar el servidor HTTP REST: %v", err)
	}
}
