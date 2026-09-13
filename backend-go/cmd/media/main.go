package main

import (
	"fmt"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/database"
)

func main() {
	fmt.Println("Iniciando microservicio Media...")
	database.ConnectDB()
	// TODO: Inicializar servidor HTTP REST para Media (Cloudinary upload)
}
