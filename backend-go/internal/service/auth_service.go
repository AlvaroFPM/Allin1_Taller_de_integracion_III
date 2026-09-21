package service

import (
	"context"
	"fmt"
	"regexp"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// AuthService implementa la interfaz gRPC AuthServiceServer
type AuthService struct {
	auth.UnimplementedAuthServiceServer
	validate *validator.Validate
}

// Custom validator para RN-06
func passwordRuleValid(fl validator.FieldLevel) bool {
	pwd := fl.Field().String()
	if len(pwd) < 8 || len(pwd) > 64 {
		return false
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(pwd)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(pwd)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(pwd)
	hasSpecial := regexp.MustCompile(`[\W_]`).MatchString(pwd)
	return hasUpper && hasLower && hasNumber && hasSpecial
}

// NewAuthService crea una nueva instancia de AuthService
func NewAuthService() *AuthService {
	v := validator.New()
	v.RegisterValidation("password_rn06", passwordRuleValid)
	return &AuthService{
		validate: v,
	}
}

// Register maneja la creación de nuevos usuarios
func (s *AuthService) Register(ctx context.Context, req *auth.RegisterRequest) (*auth.RegisterResponse, error) {
	// 1. Validación de estructuras (Regla de Negocio RN-06)
	input := struct {
		FirstName string `validate:"required,min=2"`
		LastName  string `validate:"required,min=2"`
		Email     string `validate:"required,email"`
		Password  string `validate:"required,password_rn06"`
	}{
		FirstName: req.GetFirstName(),
		LastName:  req.GetLastName(),
		Email:     req.GetEmail(),
		Password:  req.GetPassword(),
	}

	if err := s.validate.Struct(input); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "datos de registro inválidos: %v", err)
	}

	// TODO: Implementar hasheo de contraseña y guardado en DB
	fmt.Printf("Recibida petición de registro para email: %s\n", req.GetEmail())

	return &auth.RegisterResponse{
		UserId:  1, // ID mockeado por ahora
		Message: "Usuario registrado exitosamente",
		Token:   "mock-jwt-token-para-registro",
	}, nil
}

// Login maneja la autenticación de usuarios
func (s *AuthService) Login(ctx context.Context, req *auth.LoginRequest) (*auth.LoginResponse, error) {
	// 1. Validación de estructuras
	input := struct {
		Email    string `validate:"required,email"`
		Password string `validate:"required"`
	}{
		Email:    req.GetEmail(),
		Password: req.GetPassword(),
	}

	if err := s.validate.Struct(input); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "datos de login inválidos: %v", err)
	}

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
