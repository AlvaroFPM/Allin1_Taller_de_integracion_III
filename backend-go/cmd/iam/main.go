package main

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/services"
	"google.golang.org/grpc"
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

	// Inicializar servidor gRPC
	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}

	address := fmt.Sprintf(":%s", port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("Error al intentar escuchar en el puerto %s: %v", port, err)
	}

	grpcServer := grpc.NewServer()

	// Inyectar el servicio Auth
	authService := services.NewAuthService()
	auth.RegisterAuthServiceServer(grpcServer, authService)

	// Habilitar reflexión para depuración
	reflection.Register(grpcServer)

	log.Printf("Servidor gRPC de IAM (Auth) iniciado y escuchando en el puerto %s...\n", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Error al iniciar el servidor gRPC: %v", err)
	}
}
