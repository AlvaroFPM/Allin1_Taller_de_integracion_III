package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"strings"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
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

	require.NoError(t, err, "Se esperaba éxito, pero falló con error")
	require.NotNil(t, res, "Se esperaba una respuesta")
	assert.NotEmpty(t, res.Token, "Se esperaba una respuesta con token, pero está vacía")
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

	require.Error(t, err, "Se esperaba un error por email inválido, pero pasó la validación")
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

	require.Error(t, err, "Se esperaba un error por contraseña muy corta, pero pasó la validación")
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
// =====================================================================
// UpdateProfile (HDU #234)
// =====================================================================

func TestUserIDFromContext(t *testing.T) {
	t.Run("devuelve el ID inyectado por el interceptor", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.UserIDKey, uint(7))

		id, err := userIDFromContext(ctx)

		require.NoError(t, err)
		assert.Equal(t, uint(7), id)
	})

	t.Run("sin ID en el contexto retorna Unauthenticated", func(t *testing.T) {
		_, err := userIDFromContext(context.Background())

		require.Error(t, err)
		st, ok := status.FromError(err)
		require.True(t, ok)
		assert.Equal(t, codes.Unauthenticated, st.Code())
	})
}

func TestValidateUpdateProfileRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     *auth.UpdateProfileRequest
		wantErr bool
	}{
		{"request vacio es valido", &auth.UpdateProfileRequest{}, false},
		{"telefono con formato internacional", &auth.UpdateProfileRequest{Telefono: "+56 9 1234 5678"}, false},
		{"telefono con letras", &auth.UpdateProfileRequest{Telefono: "abc"}, true},
		{"telefono demasiado corto", &auth.UpdateProfileRequest{Telefono: "123"}, true},
		{"telefono demasiado largo", &auth.UpdateProfileRequest{Telefono: "+5691234567890123456789"}, true},
		{"ciudad de 100 caracteres es valida", &auth.UpdateProfileRequest{Ciudad: strings.Repeat("a", 100)}, false},
		{"ciudad de 101 caracteres es invalida", &auth.UpdateProfileRequest{Ciudad: strings.Repeat("a", 101)}, true},
		{"region de 101 caracteres es invalida", &auth.UpdateProfileRequest{Region: strings.Repeat("a", 101)}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUpdateProfileRequest(tt.req)

			if !tt.wantErr {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, codes.InvalidArgument, st.Code())
		})
	}
}

func TestUpdateProfileByUserID(t *testing.T) {
	t.Run("actualiza un perfil existente", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "actualiza@example.com")
		seedPerfil(t, db, usuario.IDUsuario)
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(usuario.IDUsuario, &auth.UpdateProfileRequest{
			BioExperiencia: "Bio nueva",
			Telefono:       "+56922222222",
			Habilidades:    "Python, SQL",
			Ciudad:         "Concepcion",
			Region:         "Biobio",
		})

		require.NoError(t, err)
		assert.Equal(t, "Bio nueva", resp.BioExperiencia)
		assert.Equal(t, "+56922222222", resp.Telefono)
		assert.Equal(t, "Concepcion", resp.Ciudad)
		assert.Equal(t, "actualiza@example.com", resp.Email)

		// Debe seguir habiendo un unico perfil por usuario (relacion 1 a 1)
		var count int64
		require.NoError(t, db.Model(&models.Perfil{}).Where("id_usuario = ?", usuario.IDUsuario).Count(&count).Error)
		assert.EqualValues(t, 1, count)
	})

	t.Run("crea el perfil si el usuario aun no tiene uno", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "sinperfil-update@example.com")
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(usuario.IDUsuario, &auth.UpdateProfileRequest{
			BioExperiencia: "Primera bio",
			Ciudad:         "Temuco",
		})

		require.NoError(t, err)
		assert.Equal(t, "Primera bio", resp.BioExperiencia)
		assert.Equal(t, "Temuco", resp.Ciudad)

		var count int64
		require.NoError(t, db.Model(&models.Perfil{}).Where("id_usuario = ?", usuario.IDUsuario).Count(&count).Error)
		assert.EqualValues(t, 1, count)
	})

	t.Run("campos vacios reemplazan los valores guardados", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "vacia@example.com")
		seedPerfil(t, db, usuario.IDUsuario)
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(usuario.IDUsuario, &auth.UpdateProfileRequest{})

		require.NoError(t, err)
		assert.Empty(t, resp.BioExperiencia)
		assert.Empty(t, resp.Telefono)
		assert.Empty(t, resp.Habilidades)
		assert.Empty(t, resp.Ciudad)
		assert.Empty(t, resp.Region)
	})

	t.Run("recorta espacios en blanco al inicio y al final", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "espacios@example.com")
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(usuario.IDUsuario, &auth.UpdateProfileRequest{
			Ciudad: "  Valdivia  ",
		})

		require.NoError(t, err)
		assert.Equal(t, "Valdivia", resp.Ciudad)
	})

	t.Run("usuario inexistente retorna NotFound", func(t *testing.T) {
		db := setupIamTestDB(t)
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(999999, &auth.UpdateProfileRequest{Ciudad: "Temuco"})

		require.Error(t, err)
		assert.Nil(t, resp)
		st, ok := status.FromError(err)
		require.True(t, ok)
		assert.Equal(t, codes.NotFound, st.Code())
	})

	t.Run("datos invalidos retornan InvalidArgument y no modifican el perfil", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "invalido@example.com")
		seedPerfil(t, db, usuario.IDUsuario)
		srv := NewAuthService(db)

		resp, err := srv.updateProfileByUserID(usuario.IDUsuario, &auth.UpdateProfileRequest{Telefono: "abc"})

		require.Error(t, err)
		assert.Nil(t, resp)
		st, ok := status.FromError(err)
		require.True(t, ok)
		assert.Equal(t, codes.InvalidArgument, st.Code())

		// El perfil sembrado debe seguir intacto
		var perfil models.Perfil
		require.NoError(t, db.Where("id_usuario = ?", usuario.IDUsuario).First(&perfil).Error)
		assert.Equal(t, "+56911111111", perfil.Telefono)
	})

	t.Run("sin conexion a base de datos retorna Internal", func(t *testing.T) {
		srv := NewAuthService(nil)

		_, err := srv.updateProfileByUserID(1, &auth.UpdateProfileRequest{})

		require.Error(t, err)
		st, ok := status.FromError(err)
		require.True(t, ok)
		assert.Equal(t, codes.Internal, st.Code())
	})
}

func TestUpdateProfile_UsaElUsuarioDelContexto(t *testing.T) {
	t.Run("sin usuario en el contexto retorna Unauthenticated", func(t *testing.T) {
		srv := NewAuthService(nil)

		_, err := srv.UpdateProfile(context.Background(), &auth.UpdateProfileRequest{})

		require.Error(t, err)
		st, ok := status.FromError(err)
		require.True(t, ok)
		assert.Equal(t, codes.Unauthenticated, st.Code())
	})

	t.Run("con usuario en el contexto actualiza su perfil", func(t *testing.T) {
		db := setupIamTestDB(t)
		usuario := seedUsuario(t, db, "ctx@example.com")
		srv := NewAuthService(db)
		ctx := context.WithValue(context.Background(), middleware.UserIDKey, usuario.IDUsuario)

		resp, err := srv.UpdateProfile(ctx, &auth.UpdateProfileRequest{Ciudad: "Osorno"})

		require.NoError(t, err)
		assert.EqualValues(t, usuario.IDUsuario, resp.UserId)
		assert.Equal(t, "Osorno", resp.Ciudad)
	})
}