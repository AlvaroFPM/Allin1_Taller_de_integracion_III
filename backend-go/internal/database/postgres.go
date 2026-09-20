package database

import (
	"fmt"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB es la instancia global de la base de datos
var DB *gorm.DB

// getEnv obtiene una variable de entorno o retorna un valor por defecto si no está definida
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// ConnectDB inicializa la conexión con PostgreSQL leyendo las variables de entorno.
// Retorna el error en vez de terminar el proceso, para que cada
// microservicio decida si la falta de DB es crítica o no.
func ConnectDB() (*gorm.DB, error) {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "postgres")
	sslMode := getEnv("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		host, user, password, dbName, port, sslMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("error al conectar a la base de datos: %w", err)
	}

	DB = db
	fmt.Printf("¡Conexión a PostgreSQL (%s) exitosa!\n", dbName)
	return db, nil
}