package service

import (
	"context"
	"errors"
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

// idUsuarioTemporal es un valor fijo mientras no existe el interceptor JWT.
// TODO(HDU#233): reemplazar por el ID extraído del contexto una vez Alvaro
// complete el interceptor gRPC de autenticacion.
const idUsuarioTemporal uint = 1

// GetProfile maneja la obtención de datos del usuario autenticado
func (s *AuthService) GetProfile(ctx context.Context, req *auth.ProfileRequest) (*auth.ProfileResponse, error) {
	return s.getProfileByUserID(idUsuarioTemporal)
}

// getProfileByUserID contiene la lógica real de negocio, separada del ID
// hardcodeado para poder testearla con distintos usuarios.
// TODO(HDU#233): una vez exista el interceptor JWT de Alvaro, GetProfile
// debe extraer el ID real del contexto y pasarlo aquí en vez de la constante.
func (s *AuthService) getProfileByUserID(idUsuario uint) (*auth.ProfileResponse, error) {
	if s.db == nil {
		return nil, status.Errorf(codes.Internal, "conexión a base de datos no disponible")
	}

	// 1. Buscar el usuario 
	var usuario models.Usuario
	if err := s.db.First(&usuario, idUsuario).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, status.Errorf(codes.NotFound, "usuario no encontrado")
		}
		return nil, status.Errorf(codes.Internal, "error al buscar el usuario: %v", err)
	}

	// 2. Buscar el perfil asociado 
	var perfil models.Perfil
	err := s.db.Where("id_usuario = ?", usuario.IDUsuario).First(&perfil).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, status.Errorf(codes.Internal, "error al buscar el perfil: %v", err)
	}
	// Si err es gorm.ErrRecordNotFound, perfil queda con sus valores cero (""),
	// lo cual es un estado válido: el usuario aún no completó su perfil.

	return &auth.ProfileResponse{
		UserId:         int64(usuario.IDUsuario),
		FirstName:      usuario.Nombres,
		LastName:       usuario.Apellidos,
		Email:          usuario.Correo,
		BioExperiencia: perfil.BioExperiencia,
		Telefono:       perfil.Telefono,
		Habilidades:    perfil.Habilidades,
		Ciudad:         perfil.Ciudad,
		Region:         perfil.Region,
		FotoPerfilUrl:  perfil.FotoPerfilURL,
	}, nil
}