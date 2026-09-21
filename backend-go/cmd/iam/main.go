package main

import (
	"fmt"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
)

func main() {
	fmt.Println("Iniciando microservicio IAM (Auth)...")
	// TODO: ConnectDB() devuelve (*gorm.DB, error) intencionalmente para no
	// terminar el proceso automáticamente. Este código actualmente ignora el
	// error retornado, lo que causa un panic (nil pointer dereference) si la
	// conexión a la base de datos falla. Falta manejar el error explícitamente
	// antes de usar el *gorm.DB retornado. Detectado en PR #117.
	database.ConnectDB()
	// TODO: Inicializar servidor gRPC y grpc-gateway para Auth
}
