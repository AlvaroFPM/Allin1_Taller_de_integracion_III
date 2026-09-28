package service

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
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

// =====================================================================
// GetProfile - tests contra postgres_iam real
// =====================================================================

func setupIamTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	pass := os.Getenv("POSTGRES_PASSWORD_IAM")
	if pass == "" {
		pass = "postgres"
	}
	dsn := fmt.Sprintf("host=localhost port=5433 user=postgres password=%s dbname=iam_db sslmode=disable", pass)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err == nil {
		sqlDB, pingErr := db.DB()
		if pingErr == nil {
			err = sqlDB.Ping()
		} else {
			err = pingErr
		}
	}

	if err != nil {
		if os.Getenv("CI") != "" {
			t.Skip("Saltando test de integración en CI: postgres_iam no disponible en el runner")
		}
		require.NoError(t, err, "¿está levantado docker-compose up -d postgres_iam?")
	}

	require.NoError(t, db.AutoMigrate(&models.Usuario{}))
	require.NoError(t, db.AutoMigrate(&models.Perfil{}))

	tx := db.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return tx
}

func seedUsuario(t *testing.T, db *gorm.DB, correo string) models.Usuario {
	t.Helper()
	u := models.Usuario{
		Rut:          "22222222-2",
		Nombres:      "Test",
		Apellidos:    "Usuario",
		Correo:       correo,
		PasswordHash: "hash-no-relevante-para-este-test",
		Rol:          "CLIENTE",
		EstadoActivo: true,
	}
	require.NoError(t, db.Create(&u).Error)
	return u
}

func seedPerfil(t *testing.T, db *gorm.DB, idUsuario uint) models.Perfil {
	t.Helper()
	p := models.Perfil{
		IDUsuario:      idUsuario,
		BioExperiencia: "Bio de prueba",
		Telefono:       "+56911111111",
		Habilidades:    "Testing, Go",
		Ciudad:         "Puerto Montt",
		Region:         "Los Lagos",
		FotoPerfilURL:  "",
	}
	require.NoError(t, db.Create(&p).Error)
	return p
}

func TestGetProfileByUserID(t *testing.T) {
	t.Run("usuario con perfil completo devuelve todos los campos", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "conperfil@example.com")
		seedPerfil(t, db, usuario.IDUsuario)
		srv := NewAuthService(db)

		resp, err := srv.getProfileByUserID(usuario.IDUsuario)

		require.NoError(t, err)
		assert.EqualValues(t, usuario.IDUsuario, resp.UserId)
		assert.Equal(t, "Test", resp.FirstName)
		assert.Equal(t, "conperfil@example.com", resp.Email)
		assert.Equal(t, "Bio de prueba", resp.BioExperiencia)
		assert.Equal(t, "+56911111111", resp.Telefono)
		assert.Equal(t, "Puerto Montt", resp.Ciudad)
	})

	t.Run("usuario sin perfil devuelve datos de usuario con campos de perfil vacios", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "sinperfil@example.com")
		srv := NewAuthService(db)

		resp, err := srv.getProfileByUserID(usuario.IDUsuario)

		require.NoError(t, err)
		assert.EqualValues(t, usuario.IDUsuario, resp.UserId)
		assert.Equal(t, "sinperfil@example.com", resp.Email)
		assert.Empty(t, resp.BioExperiencia)
		assert.Empty(t, resp.Telefono)
		assert.Empty(t, resp.Ciudad)
	})

	t.Run("usuario inexistente retorna codes.NotFound", func(t *testing.T) {
		db := setupIamTestDB(t)
		srv := NewAuthService(db)

		resp, err := srv.getProfileByUserID(999999)

		require.Error(t, err)
		assert.Nil(t, resp)
		st, ok := status.FromError(err)
		require.True(t, ok, "el error retornado no es un gRPC status error: %v", err)
		assert.Equal(t, codes.NotFound, st.Code())
	})
}