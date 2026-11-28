package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"

	ordersapi "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/orders"
	publicationpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	fmt.Println("Iniciando microservicio Orders (Órdenes)...")

	// 1. Validar variables de entorno críticas antes de abrir puertos o conectar servicios
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" {
		log.Fatalf("Error crítico de configuración: la variable de entorno JWT_SECRET es obligatoria para iniciar el microservicio Orders")
	}

	// 2. Conexión estricta a PostgreSQL (falla de forma visible ante BD inválida, sin simular persistencia)
	db, err := database.ConnectDB()
	if err != nil {
		log.Fatalf("Error crítico al conectar a la base de datos de Orders: %v", err)
	}

	// 2. AutoMigrate de las entidades del dominio Orders en la base de datos relacional
	if err := db.AutoMigrate(&models.Orden{}, &models.OrderExtra{}, &models.OrderReview{}); err != nil {
		log.Fatalf("Error crítico al ejecutar AutoMigrate de las tablas de Orders: %v", err)
	}
	fmt.Println("Migración exitosa: Tablas 'ordenes', 'order_extras' y 'order_reviews' sincronizadas.")

	// 2b. Índice único parcial para RN-22 (impide órdenes activas duplicadas)
	if err := service.EnsureActiveOrderUniqueIndex(db); err != nil {
		log.Fatalf("Error crítico al crear el índice de órdenes activas: %v", err)
	}
	fmt.Println("Índice de órdenes activas verificado.")

	// 3. Configuración de puertos de comunicación (alineados con Compose y K8s)
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50053"
	}
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8084"
	}

	// 4. Iniciar Listener TCP para el servidor gRPC
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Fallo crítico al escuchar en puerto gRPC %s: %v", grpcPort, err)
	}

	// 5. Iniciar Servidor gRPC nativo con interceptor de autenticación JWT
	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(middleware.UnaryAuthInterceptor()),
	)

	// Cliente gRPC hacia Catálogo (ALL-141). NewClient es perezoso: si Catálogo está caído
	// el servicio arranca, y CreateOrder responde Unavailable al intentar validar.
	catalogAddr := strings.TrimSpace(os.Getenv("CATALOG_GRPC_ADDR"))
	if catalogAddr == "" {
		catalogAddr = "localhost:50052"
	}
	catalogConn, err := grpc.NewClient(catalogAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Error crítico al crear el cliente de Catálogo (%s): %v", catalogAddr, err)
	}
	defer catalogConn.Close()

	orderService := service.NewOrderService(db, publicationpb.NewPublicationServiceClient(catalogConn))
	orderServer := service.NewOrderServiceServer(orderService)
	ordersapi.RegisterGRPCRouter(grpcServer, orderServer)

	go func() {
		fmt.Printf("Servidor gRPC de Orders escuchando en el puerto %s...\n", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Fallo crítico al iniciar servidor gRPC de Orders: %v", err)
		}
	}()

	// 6. Iniciar Servidor REST (gRPC-Gateway)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	if err := ordersapi.RegisterGatewayRouter(ctx, mux, "localhost:"+grpcPort, opts); err != nil {
		log.Fatalf("Fallo crítico al registrar gRPC-Gateway de Orders: %v", err)
	}

	extensionsHandler := ordersapi.NewExtensionsHandler(db)
	rootHandler := extensionsHandler.WrapHandler(mux)

	// 7. Configuración de CORS para clientes web (Next.js)
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}).Handler(rootHandler)

	fmt.Printf("Servidor REST (gRPC-Gateway) de Orders escuchando en el puerto %s...\n", httpPort)
	if err := http.ListenAndServe(":"+httpPort, handler); err != nil {
		log.Fatalf("Fallo crítico al iniciar el servidor HTTP REST de Orders: %v", err)
	}
}

