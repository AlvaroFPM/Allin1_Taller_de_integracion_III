package services

import (
	"context"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
)

func TestAuthService_Register_Valid(t *testing.T) {
	service := NewAuthService()
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "alvaro@example.com",
		Password:  "secreta123",
	}

	res, err := service.Register(context.Background(), req)
	
	if err != nil {
		t.Fatalf("Se esperaba éxito, pero falló con error: %v", err)
	}

	if res == nil || res.Token == "" {
		t.Errorf("Se esperaba una respuesta con token, pero está vacía")
	}
}

func TestAuthService_Register_InvalidEmail(t *testing.T) {
	service := NewAuthService()
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "correo-invalido", // Falla la validación 'email'
		Password:  "secreta123",
	}

	_, err := service.Register(context.Background(), req)
	
	if err == nil {
		t.Errorf("Se esperaba un error por email inválido, pero pasó la validación")
	}
}

func TestAuthService_Register_ShortPassword(t *testing.T) {
	service := NewAuthService()
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "alvaro@example.com",
		Password:  "123", // Falla la validación 'min=6'
	}

	_, err := service.Register(context.Background(), req)
	
	if err == nil {
		t.Errorf("Se esperaba un error por contraseña muy corta, pero pasó la validación")
	}
}
