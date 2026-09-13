package main

import (
	"fmt"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
)

func main() {
	fmt.Println("Iniciando microservicio IAM (Auth)...")
	database.ConnectDB()
	// TODO: Inicializar servidor gRPC y grpc-gateway para Auth
}
