package services

import (
	"context"
	"fmt"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
)

// AuthService implementa la interfaz gRPC AuthServiceServer
type AuthService struct {
	auth.UnimplementedAuthServiceServer
}

// NewAuthService crea una nueva instancia de AuthService
func NewAuthService() *AuthService {
	return &AuthService{}
}

// Register maneja la creación de nuevos usuarios
func (s *AuthService) Register(ctx context.Context, req *auth.RegisterRequest) (*auth.RegisterResponse, error) {
	// TODO: Implementar validación de structs, hasheo de contraseña y guardado en DB
	fmt.Printf("Recibida petición de registro para email: %s\n", req.GetEmail())

	return &auth.RegisterResponse{
		UserId:  1, // ID mockeado por ahora
		Message: "Usuario registrado exitosamente",
		Token:   "mock-jwt-token-para-registro",
	}, nil
}

// Login maneja la autenticación de usuarios
func (s *AuthService) Login(ctx context.Context, req *auth.LoginRequest) (*auth.LoginResponse, error) {
	// TODO: Implementar búsqueda en DB, comparación de bcrypt y generación de JWT real
	fmt.Printf("Recibida petición de login para email: %s\n", req.GetEmail())

	return &auth.LoginResponse{
		Token:   "mock-jwt-token-para-login",
		Message: "Login exitoso",
	}, nil
}

// GetProfile maneja la obtención de datos del usuario autenticado
func (s *AuthService) GetProfile(ctx context.Context, req *auth.ProfileRequest) (*auth.ProfileResponse, error) {
	// TODO: Obtener el ID del usuario desde el contexto (extraído por el interceptor JWT) y buscar en DB
	fmt.Println("Recibida petición de perfil de usuario")

	return &auth.ProfileResponse{
		UserId:    1,
		FirstName: "Juan",
		LastName:  "Perez",
		Email:     "juan.perez@example.com",
	}, nil
}
