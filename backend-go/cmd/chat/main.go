package main

import (
	"fmt"
	"log"
	"net"
	"os"

	chatapi "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/chat"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"google.golang.org/grpc"
	"gorm.io/gorm"
)

func main() {
	fmt.Println("Iniciando microservicio Chat...")

	// 1. Conexión a la base de datos
	var db *gorm.DB
	db, err := database.ConnectDB()
	if err != nil {
		log.Printf("Aviso: No se pudo conectar a la base de datos de Chat: %v. Operando en modo memoria.", err)
	} else {
		// AutoMigrate de tablas de Chat
		if err := db.AutoMigrate(&models.ChatSala{}, &models.ChatMensaje{}); err != nil {
			log.Fatalf("Error al migrar tablas de Chat: %v", err)
		}
		fmt.Println("Migración exitosa: Tablas 'chat_salas' y 'chat_mensajes' sincronizadas.")
	}

	// 2. Configuración de puertos
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50054" // Puerto oficial del microservicio Chat (según Dockerfile.chat)
	}

	// 3. Iniciar Listener gRPC
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Fallo al escuchar en puerto %s: %v", grpcPort, err)
	}

	// 4. Instanciar servidor gRPC con interceptor de autenticación
	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)

	// 5. Instanciar servicio y registrar Router gRPC
	chatService := service.NewChatServiceServer(db)
	chatapi.RegisterGRPCRouter(grpcServer, chatService)

	fmt.Printf("Servidor gRPC de Chat escuchando en el puerto %s...\n", grpcPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Fallo al ejecutar servidor gRPC de Chat: %v", err)
	}
}
