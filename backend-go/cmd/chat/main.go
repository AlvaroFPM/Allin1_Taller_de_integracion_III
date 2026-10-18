package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	chatapi "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/chat"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
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
		grpcPort = "50054" // Puerto oficial gRPC según Dockerfile.chat
	}
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8085" // Puerto oficial REST/Gateway según Dockerfile.chat
	}

	// 3. Iniciar Listener gRPC
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Fallo al escuchar en puerto gRPC %s: %v", grpcPort, err)
	}

	// 4. Instanciar servidor gRPC con interceptor de autenticación
	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)

	// 5. Instanciar servicio y registrar Router gRPC
	chatService := service.NewChatServiceServer(db)
	chatapi.RegisterGRPCRouter(grpcServer, chatService)

	// Iniciar servidor gRPC en goroutine en segundo plano
	go func() {
		fmt.Printf("Servidor gRPC de Chat escuchando en el puerto %s...\n", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Fallo al ejecutar servidor gRPC de Chat: %v", err)
		}
	}()

	// 6. Iniciar Servidor REST (gRPC-Gateway)
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	if err := chatapi.RegisterGatewayRouter(ctx, mux, "localhost:"+grpcPort, opts); err != nil {
		log.Fatalf("Fallo al registrar gRPC-Gateway de Chat: %v", err)
	}

	// 7. Configuración de CORS para clientes web (Next.js)
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}).Handler(mux)

	fmt.Printf("Servidor REST (gRPC-Gateway) de Chat escuchando en el puerto %s...\n", httpPort)
	if err := http.ListenAndServe(":"+httpPort, handler); err != nil {
		log.Fatalf("Fallo al iniciar el servidor HTTP REST de Chat: %v", err)
	}
}
