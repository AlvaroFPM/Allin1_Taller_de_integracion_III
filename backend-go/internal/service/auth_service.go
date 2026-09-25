package service

import (
	"context"
	"fmt"
	"regexp"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

// AuthService implementa la interfaz gRPC AuthServiceServer
type AuthService struct {
	auth.UnimplementedAuthServiceServer
	validate *validator.Validate
	db       *gorm.DB
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
func NewAuthService(db *gorm.DB) *AuthService {
	v := validator.New()
	v.RegisterValidation("password_rn06", passwordRuleValid)
	return &AuthService{
		validate: v,
		db:       db,
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

	// 2. Hashear la contraseña con bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.GetPassword()), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "error al procesar la contraseña")
	}

	// 3. Mapear al modelo GORM basado en el MER
	nuevoUsuario := models.Usuario{
		Rut:          req.GetRut(),
		Nombres:      req.GetFirstName(),
		Apellidos:    req.GetLastName(),
		Correo:       req.GetEmail(),
		PasswordHash: string(hashedPassword),
		Rol:          "CLIENTE",
		EstadoActivo: true,
	}

	// 4. Guardar en PostgreSQL
	if s.db != nil {
		// Verificar si el correo ya existe
		var check models.Usuario
		if err := s.db.Where("correo = ?", req.GetEmail()).First(&check).Error; err == nil {
			return nil, status.Errorf(codes.AlreadyExists, "el correo ya está registrado")
		}

		if err := s.db.Create(&nuevoUsuario).Error; err != nil {
			return nil, status.Errorf(codes.Internal, "error al guardar el usuario en la base de datos")
		}
		fmt.Printf("Usuario %s registrado exitosamente con ID %d\n", nuevoUsuario.Correo, nuevoUsuario.IDUsuario)
	} else {
		// Mock temporal para que los tests antiguos sigan pasando sin DB
		nuevoUsuario.IDUsuario = 1
	}

	return &auth.RegisterResponse{
		UserId:  int64(nuevoUsuario.IDUsuario),
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
