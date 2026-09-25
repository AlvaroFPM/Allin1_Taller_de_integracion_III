package service

import (
	"context"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
)

func TestAuthService_Register_Valid(t *testing.T) {
	service := NewAuthService(nil)
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "alvaro@example.com",
		Password:  "Secreta.123!", // Cumple RN-06: 8+ chars, Mayúscula, Minúscula, Número, Especial
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
	service := NewAuthService(nil)
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "correo-invalido", // Falla la validación 'email'
		Password:  "Secreta.123!",
	}

	_, err := service.Register(context.Background(), req)

	if err == nil {
		t.Errorf("Se esperaba un error por email inválido, pero pasó la validación")
	}
}

func TestAuthService_Register_ShortPassword(t *testing.T) {
	service := NewAuthService(nil)
	req := &auth.RegisterRequest{
		FirstName: "Alvaro",
		LastName:  "Perez",
		Email:     "alvaro@example.com",
		Password:  "Secre1!", // Falla RN-06 por tener menos de 8 caracteres
	}

	_, err := service.Register(context.Background(), req)

	if err == nil {
		t.Errorf("Se esperaba un error por contraseña muy corta, pero pasó la validación")
	}
}
