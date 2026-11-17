package service

import (
	"context"
	"strings"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/auth"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ALL-180: el limite incluye el prefijo + y coincide con varchar(20).
func TestProfilePhoneTotalLength(t *testing.T) {
	for _, tc := range []struct {
		name, phone string
		valid       bool
	}{
		{"20 sin prefijo", strings.Repeat("1", 20), true},
		{"20 con prefijo", "+" + strings.Repeat("1", 19), true},
		{"21 con prefijo", "+" + strings.Repeat("1", 20), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := validateUpdateProfileRequest(&auth.UpdateProfileRequest{Telefono: tc.phone})
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Equal(t, codes.InvalidArgument, status.Code(err))
			}
		})
	}
}

func TestProfileRejectedUpdatePreservesDatabase(t *testing.T) {
	t.Setenv("CLOUDINARY_CLOUD_NAME", "all180-test")
	prefix := "https://res.cloudinary.com/all180-test/"
	cases := []struct {
		name   string
		change func(*auth.UpdateProfileRequest)
	}{
		{"telefono letras", func(r *auth.UpdateProfileRequest) { r.Telefono = "abc" }},
		{"telefono corto", func(r *auth.UpdateProfileRequest) { r.Telefono = "123456" }},
		{"telefono 21", func(r *auth.UpdateProfileRequest) { r.Telefono = strings.Repeat("1", 21) }},
		{"telefono 21 con mas", func(r *auth.UpdateProfileRequest) { r.Telefono = "+" + strings.Repeat("1", 20) }},
		{"ciudad 101 unicode", func(r *auth.UpdateProfileRequest) { r.Ciudad = strings.Repeat("ñ", 101) }},
		{"region 101 unicode", func(r *auth.UpdateProfileRequest) { r.Region = strings.Repeat("ñ", 101) }},
		{"foto externa", func(r *auth.UpdateProfileRequest) { r.FotoPerfilUrl = "https://example.com/a.png" }},
		{"portada externa", func(r *auth.UpdateProfileRequest) { r.PortadaUrl = "https://example.com/a.png" }},
		{"foto otro cloud", func(r *auth.UpdateProfileRequest) { r.FotoPerfilUrl = "https://res.cloudinary.com/otro/a.png" }},
		{"foto HTTP", func(r *auth.UpdateProfileRequest) {
			r.FotoPerfilUrl = strings.Replace(prefix, "https:", "http:", 1) + "a.png"
		}},
		{"foto 501", func(r *auth.UpdateProfileRequest) { r.FotoPerfilUrl = prefix + strings.Repeat("a", 501-len(prefix)) }},
		{"portada 501", func(r *auth.UpdateProfileRequest) { r.PortadaUrl = prefix + strings.Repeat("a", 501-len(prefix)) }},
	}
	for _, existing := range []bool{true, false} {
		state := "sin perfil"
		if existing {
			state = "con perfil"
		}
		t.Run(state, func(t *testing.T) {
			for _, tc := range cases {
				t.Run(tc.name, func(t *testing.T) {
					db := setupIamTestDB(t)
					user := seedUsuario(t, db, "all180-rejected@example.com")
					var userBefore models.Usuario
					require.NoError(t, db.First(&userBefore, user.IDUsuario).Error)
					if existing {
						seedPerfil(t, db, user.IDUsuario)
					}
					var before []models.Perfil
					require.NoError(t, db.Where("id_usuario = ?", user.IDUsuario).Find(&before).Error)
					req := &auth.UpdateProfileRequest{BioExperiencia: "Cambio", Telefono: "1234567", Habilidades: "Cambio", Ciudad: "Cambio", Region: "Cambio", FotoPerfilUrl: prefix + "new.png", PortadaUrl: prefix + "cover.png"}
					tc.change(req)
					ctx := context.WithValue(context.Background(), middleware.UserIDKey, user.IDUsuario)
					resp, err := NewAuthService(db).UpdateProfile(ctx, req)
					require.Equal(t, codes.InvalidArgument, status.Code(err))
					require.Nil(t, resp)
					var after []models.Perfil
					require.NoError(t, db.Where("id_usuario = ?", user.IDUsuario).Find(&after).Error)
					require.Equal(t, before, after, "todos los campos y fechas deben permanecer intactos")
					var userAfter models.Usuario
					require.NoError(t, db.First(&userAfter, user.IDUsuario).Error)
					require.Equal(t, userBefore, userAfter)
					t.Logf("BD antes=%d perfiles; despues=%d; filas completas sin cambios; codigo=InvalidArgument", len(before), len(after))
				})
			}
		})
	}
}

func TestProfileAcceptedUpdateDatabase(t *testing.T) {
	t.Setenv("CLOUDINARY_CLOUD_NAME", "all180-test")
	prefix := "https://res.cloudinary.com/all180-test/"
	for _, existing := range []bool{false, true} {
		name := "crea perfil ausente"
		if existing {
			name = "actualiza perfil existente"
		}
		t.Run(name, func(t *testing.T) {
			db := setupIamTestDB(t)
			user := seedUsuario(t, db, "all180-accepted@example.com")
			if existing {
				seedPerfil(t, db, user.IDUsuario)
			}
			ctx := context.WithValue(context.Background(), middleware.UserIDKey, user.IDUsuario)
			srv := NewAuthService(db)
			req := &auth.UpdateProfileRequest{BioExperiencia: "  Bio  ", Telefono: "+" + strings.Repeat("1", 19), Habilidades: "  Go  ", Ciudad: strings.Repeat("ñ", 100), Region: strings.Repeat("á", 100), FotoPerfilUrl: prefix + strings.Repeat("a", 500-len(prefix)), PortadaUrl: prefix + strings.Repeat("b", 500-len(prefix))}
			resp, err := srv.UpdateProfile(ctx, req)
			require.NoError(t, err)
			var saved models.Perfil
			require.NoError(t, db.Where("id_usuario = ?", user.IDUsuario).First(&saved).Error)
			require.Equal(t, "Bio", saved.BioExperiencia)
			require.Equal(t, "Go", saved.Habilidades)
			require.Equal(t, req.Telefono, saved.Telefono)
			require.Equal(t, req.Ciudad, saved.Ciudad)
			require.Equal(t, req.Region, saved.Region)
			require.Equal(t, req.FotoPerfilUrl, saved.FotoPerfilURL)
			require.Equal(t, req.PortadaUrl, saved.PortadaURL)
			require.Equal(t, saved.Ciudad, resp.Ciudad)
			require.Equal(t, saved.Telefono, resp.Telefono)
			// Los vacios borran textos, pero conservan ambas imagenes anteriores.
			_, err = srv.UpdateProfile(ctx, &auth.UpdateProfileRequest{})
			require.NoError(t, err)
			var empty models.Perfil
			require.NoError(t, db.Where("id_usuario = ?", user.IDUsuario).First(&empty).Error)
			require.Empty(t, empty.BioExperiencia)
			require.Empty(t, empty.Telefono)
			require.Empty(t, empty.Habilidades)
			require.Empty(t, empty.Ciudad)
			require.Empty(t, empty.Region)
			require.Equal(t, saved.FotoPerfilURL, empty.FotoPerfilURL)
			require.Equal(t, saved.PortadaURL, empty.PortadaURL)
			require.Equal(t, saved.IDPerfil, empty.IDPerfil)
			var count int64
			require.NoError(t, db.Model(&models.Perfil{}).Where("id_usuario = ?", user.IDUsuario).Count(&count).Error)
			require.EqualValues(t, 1, count)
			t.Log("BD: limites 20/100/500 persistidos; luego cinco textos vacios, imagenes conservadas, un solo perfil")
		})
	}
}
