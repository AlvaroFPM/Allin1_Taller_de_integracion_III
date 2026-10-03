package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	pb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// baseValidRequest genera un CreatePublicationRequest válido para mutar en cada caso de prueba
func baseValidRequest() *pb.CreatePublicationRequest {
	return &pb.CreatePublicationRequest{
		IdUsuarioVendedor: 1,
		CategoriaId:       2,
		Titulo:            "Reparación de computadores a domicilio",
		Descripcion:       strings.Repeat("Servicio técnico especializado con amplia experiencia en la zona. ", 2), // ~130 caracteres
		TipoServicio:      pb.TipoServicio_OFERTA,
		PrecioBase:        15000,
		Ciudad:            "Temuco",
		Region:            "Araucanía",
	}
}

// setupTestDB abre una conexión real a postgres_catalog (docker-compose) y
// envuelve el test en una transacción que se revierte automáticamente al
// terminar, para no dejar basura en tu base de datos local entre corridas.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	pass := os.Getenv("POSTGRES_PASSWORD_CATALOG")
	if pass == "" {
		pass = "postgres"
	}
	dsn := fmt.Sprintf("host=localhost port=5434 user=postgres password=%s dbname=catalog_db sslmode=disable", pass)

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
			t.Skip("Saltando test de integración en CI: postgres_catalog no disponible en el runner")
		}
		require.NoError(t, err, "¿está levantado docker-compose up -d postgres_catalog?")
	}

	require.NoError(t, db.AutoMigrate(&models.Categoria{}, &models.Publicacion{}))

	tx := db.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return tx
}

func seedCategoria(t *testing.T, db *gorm.DB) models.Categoria {
	t.Helper()
	cat := models.Categoria{Nombre: "Test-Categoria", Slug: "test-categoria"}
	require.NoError(t, db.Create(&cat).Error)
	return cat
}

func seedPublicacion(t *testing.T, db *gorm.DB, catID, vendedorID uint, estado string) models.Publicacion {
	t.Helper()
	pub := models.Publicacion{
		IDUsuarioVendedor: vendedorID,
		CategoriaID:       catID,
		Titulo:            "Publicacion de prueba",
		Descripcion:       "Descripcion de prueba con largo suficiente para pasar validaciones de negocio RN-19.",
		TipoServicio:      models.TipoOferta,
		PrecioBase:        1000,
		Ciudad:            "Temuco",
		Region:            "Araucania",
		Estado:            estado,
	}
	require.NoError(t, db.Create(&pub).Error)
	return pub
}

// seedPublicacionCon crea una publicación ACTIVO con vendedor, tipo y precio explícitos.
func seedPublicacionCon(t *testing.T, db *gorm.DB, catID, vendedorID uint, tipo string, precio int64) models.Publicacion {
	t.Helper()
	pub := models.Publicacion{
		IDUsuarioVendedor: vendedorID,
		CategoriaID:       catID,
		Titulo:            "Publicacion de prueba",
		Descripcion:       "Descripcion de prueba con largo suficiente para pasar validaciones de negocio RN-19.",
		TipoServicio:      tipo,
		PrecioBase:        precio,
		Ciudad:            "Temuco",
		Region:            "Araucania",
		Estado:            models.EstadoActivo,
	}
	require.NoError(t, db.Create(&pub).Error)
	return pub
}

func ptrInt64(v int64) *int64 { return &v }

func preciosDe(pubs []*pb.Publication) []int64 {
	out := make([]int64, 0, len(pubs))
	for _, p := range pubs {
		out = append(out, p.PrecioBase)
	}
	return out
}

// =====================================================================
// TestValidateCreateRequest — refactor a testify (mismos 15 casos originales)
// =====================================================================

func TestValidateCreateRequest(t *testing.T) {
	tests := []struct {
		name        string
		mutate      func(r *pb.CreatePublicationRequest)
		wantErr     bool
		expectedErr string
	}{
		// Casos exitosos
		{
			name:    "Éxito: request con datos válidos",
			mutate:  func(r *pb.CreatePublicationRequest) {},
			wantErr: false,
		},
		{
			name: "Éxito: título de exactamente 5 caracteres (borde RN-18)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Titulo = "12345"
			},
			wantErr: false,
		},
		{
			name: "Éxito: título con tildes y caracteres especiales de 5 runas (RN-18)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Titulo = "Ñandú" // 5 caracteres (runas), 7 bytes en UTF-8
			},
			wantErr: false,
		},
		{
			name: "Éxito: descripción de exactamente 50 caracteres (borde inferior RN-19)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Descripcion = strings.Repeat("a", 50)
			},
			wantErr: false,
		},
		{
			name: "Éxito: descripción de exactamente 1000 caracteres (borde superior RN-19)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Descripcion = strings.Repeat("a", 1000)
			},
			wantErr: false,
		},
		{
			name: "Éxito: precio base mínimo permitido mayor a cero (borde RN-23)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.PrecioBase = 1
			},
			wantErr: false,
		},
		{
			name: "Éxito: tipo de servicio DEMANDA permitido (RN-11)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.TipoServicio = pb.TipoServicio_DEMANDA
			},
			wantErr: false,
		},

		// Casos de fallo por regla de negocio
		{
			name: "Fallo: usuario vendedor no enviado o en 0 (RN-11)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.IdUsuarioVendedor = 0
			},
			wantErr:     true,
			expectedErr: "el id de usuario vendedor es obligatorio (RN-11)",
		},
		{
			name: "Fallo: categoría no enviada o en 0 (RN-18)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.CategoriaId = 0
			},
			wantErr:     true,
			expectedErr: "la categoría es obligatoria (RN-18)",
		},
		{
			name: "Fallo: título menor a 5 caracteres (RN-18)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Titulo = "Abcd"
			},
			wantErr:     true,
			expectedErr: "el título debe tener al menos 5 caracteres (RN-18)",
		},
		{
			name: "Fallo: título compuesto solo de espacios en blanco (RN-18)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Titulo = "      "
			},
			wantErr:     true,
			expectedErr: "el título debe tener al menos 5 caracteres (RN-18)",
		},
		{
			name: "Fallo: descripción menor a 50 caracteres (49 letras) (RN-19)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Descripcion = strings.Repeat("b", 49)
			},
			wantErr:     true,
			expectedErr: "la descripción debe tener entre 50 y 1000 caracteres (RN-19)",
		},
		{
			name: "Fallo: descripción mayor a 1000 caracteres (1001 letras) (RN-19)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.Descripcion = strings.Repeat("c", 1001)
			},
			wantErr:     true,
			expectedErr: "la descripción debe tener entre 50 y 1000 caracteres (RN-19)",
		},
		{
			name: "Fallo: precio base igual a cero (RN-23)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.PrecioBase = 0
			},
			wantErr:     true,
			expectedErr: "el precio base debe ser un entero mayor a 0 (RN-23)",
		},
		{
			name: "Fallo: precio base negativo (RN-23)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.PrecioBase = -5000
			},
			wantErr:     true,
			expectedErr: "el precio base debe ser un entero mayor a 0 (RN-23)",
		},
		{
			name: "Fallo: tipo de servicio UNSPECIFIED (RN-11)",
			mutate: func(r *pb.CreatePublicationRequest) {
				r.TipoServicio = pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED
			},
			wantErr:     true,
			expectedErr: "debe seleccionar un tipo de servicio válido: OFERTA o DEMANDA (RN-11)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := baseValidRequest()
			tt.mutate(req)

			err := validateCreateRequest(req)

			if !tt.wantErr {
				assert.NoError(t, err)
				return
			}

			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok, "el error retornado no es un gRPC status error: %v", err)
			assert.Equal(t, codes.InvalidArgument, st.Code())
			assert.Contains(t, st.Message(), tt.expectedErr)
		})
	}
}

// =====================================================================
// TestMappers — refactor a testify (mismos 3 subtests originales)
// =====================================================================

func TestMappers(t *testing.T) {
	t.Run("Conversión protoTipoToModel", func(t *testing.T) {
		tipo, err := protoTipoToModel(pb.TipoServicio_OFERTA)
		assert.NoError(t, err)
		assert.Equal(t, models.TipoOferta, tipo)

		tipo, err = protoTipoToModel(pb.TipoServicio_DEMANDA)
		assert.NoError(t, err)
		assert.Equal(t, models.TipoDemanda, tipo)

		_, err = protoTipoToModel(pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED)
		assert.Error(t, err, "esperaba error al convertir TIPO_SERVICIO_UNSPECIFIED")
	})

	t.Run("Conversión modelTipoToProto", func(t *testing.T) {
		assert.Equal(t, pb.TipoServicio_OFERTA, modelTipoToProto(models.TipoOferta))
		assert.Equal(t, pb.TipoServicio_DEMANDA, modelTipoToProto(models.TipoDemanda))
		assert.Equal(t, pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED, modelTipoToProto("DESCONOCIDO"))
	})

	t.Run("Conversión modelEstadoToProto", func(t *testing.T) {
		assert.Equal(t, pb.EstadoPublicacion_ACTIVO, modelEstadoToProto(models.EstadoActivo))
		assert.Equal(t, pb.EstadoPublicacion_PAUSADO, modelEstadoToProto(models.EstadoPausado))
		assert.Equal(t, pb.EstadoPublicacion_COMPLETADO, modelEstadoToProto(models.EstadoCompletado))
		assert.Equal(t, pb.EstadoPublicacion_ELIMINADO, modelEstadoToProto(models.EstadoEliminado))
		assert.Equal(t, pb.EstadoPublicacion_ESTADO_PUBLICACION_UNSPECIFIED, modelEstadoToProto("OTRO"))
	})
}

// =====================================================================
// TestListPublications — NUEVO (Parte 3 de la tarea), contra Postgres real
// =====================================================================

func TestListPublications(t *testing.T) {
	// IMPORTANTE: como corremos contra el Postgres real de Docker (no una BD
	// en memoria), la tabla puede tener datos de pruebas manuales anteriores
	// (Postman, grpcurl, etc.) que el rollback de esta transacción NO borra,
	// porque ya estaban comiteados antes de que esta transacción empezara.
	// Por eso CADA test filtra por su propia categoria_id recién creada, en
	// vez de asumir que la tabla está vacía. Esto hace los tests inmunes a
	// cualquier dato preexistente, presente o futuro.

	t.Run("pagina resultados correctamente con page y limit", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		for i := 0; i < 5; i++ {
			seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoActivo)
		}
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 1, Limit: 2, CategoriaId: &catID})
		require.NoError(t, err)
		assert.Len(t, resp.Publications, 2)
		assert.EqualValues(t, 5, resp.Meta.TotalRecords)
		assert.EqualValues(t, 3, resp.Meta.TotalPages)
		assert.EqualValues(t, 1, resp.Meta.CurrentPage)

		respPage3, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 3, Limit: 2, CategoriaId: &catID})
		require.NoError(t, err)
		assert.Len(t, respPage3.Publications, 1) // resto: 5 - 2 - 2
	})

	t.Run("page menor a 1 se normaliza a 1", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoActivo)
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: -5, Limit: 10, CategoriaId: &catID})
		require.NoError(t, err)
		assert.EqualValues(t, 1, resp.Meta.CurrentPage)
	})

	t.Run("limit fuera de rango cae a 10 por defecto", func(t *testing.T) {
		db := setupTestDB(t)
		srv := NewPublicationServiceServer(db)

		// No importa el contenido de la tabla para este caso: solo nos interesa
		// el valor normalizado en Meta.Limit, que no depende de los resultados.
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 1, Limit: 500})
		require.NoError(t, err)
		assert.EqualValues(t, 10, resp.Meta.Limit)
	})

	t.Run("lista vacia retorna slice vacio, nunca null", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db) // categoría fresca, sin publicaciones asociadas
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 1, Limit: 10, CategoriaId: &catID})
		require.NoError(t, err)
		assert.NotNil(t, resp.Publications) // falla si vuelve el bug del `var` sin make()
		assert.Empty(t, resp.Publications)
		assert.EqualValues(t, 0, resp.Meta.TotalRecords)
	})

	t.Run("filtra por categoria_id", func(t *testing.T) {
		db := setupTestDB(t)
		catA := seedCategoria(t, db)
		catB := models.Categoria{Nombre: "Otra-Categoria", Slug: "otra-categoria"}
		require.NoError(t, db.Create(&catB).Error)

		seedPublicacion(t, db, catA.IDCategoria, 1, models.EstadoActivo)
		seedPublicacion(t, db, catB.IDCategoria, 1, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(catA.IDCategoria)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID,
		})
		require.NoError(t, err)
		assert.Len(t, resp.Publications, 1)
		assert.EqualValues(t, catA.IDCategoria, resp.Publications[0].CategoriaId)
	})

	t.Run("filtra por tipo_servicio", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoActivo) // OFERTA por defecto

		demanda := models.Publicacion{
			IDUsuarioVendedor: 1, CategoriaID: cat.IDCategoria, Titulo: "Busco algo",
			Descripcion:  "Descripcion de prueba con largo suficiente para pasar validaciones RN-19.",
			TipoServicio: models.TipoDemanda, PrecioBase: 500, Ciudad: "Temuco", Region: "Araucania",
			Estado: models.EstadoActivo,
		}
		require.NoError(t, db.Create(&demanda).Error)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria) // acota a la categoría de prueba: la base real puede tener más DEMANDA (seed)
		tipo := pb.TipoServicio_DEMANDA
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID, TipoServicio: &tipo,
		})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.Equal(t, pb.TipoServicio_DEMANDA, resp.Publications[0].TipoServicio)
	})

	t.Run("excluye publicaciones del usuario indicado (RN-12)", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 10, models.EstadoActivo)
		seedPublicacion(t, db, cat.IDCategoria, 20, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		excludeID := uint32(10)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID, ExcludeUserId: &excludeID,
		})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.EqualValues(t, 20, resp.Publications[0].IdUsuarioVendedor)
	})

	t.Run("excluye automaticamente al usuario logueado tomado del contexto JWT (RN-12)", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 10, models.EstadoActivo)
		seedPublicacion(t, db, cat.IDCategoria, 20, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		// El interceptor JWT inyecta el ID del usuario autenticado en el contexto
		ctx := context.WithValue(context.Background(), middleware.UserIDKey, uint(10))

		// Sin enviar exclude_user_id: la exclusión sale solo del token
		resp, err := srv.ListPublications(ctx, &pb.ListPublicationsRequest{Page: 1, Limit: 10, CategoriaId: &catID})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.EqualValues(t, 20, resp.Publications[0].IdUsuarioVendedor)
		assert.EqualValues(t, 1, resp.Meta.TotalRecords)
	})

	t.Run("el usuario del token tiene prioridad sobre exclude_user_id", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 10, models.EstadoActivo)
		seedPublicacion(t, db, cat.IDCategoria, 20, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		ctx := context.WithValue(context.Background(), middleware.UserIDKey, uint(10))
		otroID := uint32(20) // el cliente intenta excluir a otro usuario: se ignora

		resp, err := srv.ListPublications(ctx, &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID, ExcludeUserId: &otroID,
		})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.EqualValues(t, 20, resp.Publications[0].IdUsuarioVendedor) // se excluyó al 10 (token), no al 20
	})

	t.Run("sin usuario valido en el contexto se usa exclude_user_id como respaldo", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 10, models.EstadoActivo)
		seedPublicacion(t, db, cat.IDCategoria, 20, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		ctx := context.WithValue(context.Background(), middleware.UserIDKey, uint(0))
		excludeID := uint32(10)

		resp, err := srv.ListPublications(ctx, &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID, ExcludeUserId: &excludeID,
		})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.EqualValues(t, 20, resp.Publications[0].IdUsuarioVendedor)
	})

	t.Run("solo publicaciones ACTIVO aparecen en el listado", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoActivo)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoPausado)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoCompletado)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 1, Limit: 10, CategoriaId: &catID})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.Equal(t, pb.EstadoPublicacion_ACTIVO, resp.Publications[0].Estado)
	})

	t.Run("cada publicacion trae su categoria precargada", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacion(t, db, cat.IDCategoria, 1, models.EstadoActivo)

		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{Page: 1, Limit: 10, CategoriaId: &catID})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		require.NotNil(t, resp.Publications[0].Categoria)
		assert.Equal(t, cat.Nombre, resp.Publications[0].Categoria.Nombre)
	})

	// -----------------------------------------------------------------
	// Filtros de precio (min_price / max_price) — límites inclusivos
	// -----------------------------------------------------------------

	t.Run("filtra por rango de precio", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		for _, precio := range []int64{3000, 10000, 25000, 30000, 50000} {
			seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoOferta, precio)
		}
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		casos := []struct {
			nombre   string
			min, max *int64
			want     []int64
		}{
			{"sin filtro de precio devuelve todas", nil, nil, []int64{3000, 10000, 25000, 30000, 50000}},
			{"solo min (inclusivo)", ptrInt64(25000), nil, []int64{25000, 30000, 50000}},
			{"solo max (inclusivo)", nil, ptrInt64(10000), []int64{3000, 10000}},
			{"min y max (inclusivos)", ptrInt64(10000), ptrInt64(30000), []int64{10000, 25000, 30000}},
			{"min == max", ptrInt64(25000), ptrInt64(25000), []int64{25000}},
			{"min > max devuelve vacio", ptrInt64(50000), ptrInt64(10000), []int64{}},
			{"min en 0 no filtra", ptrInt64(0), nil, []int64{3000, 10000, 25000, 30000, 50000}},
			{"min negativo no filtra", ptrInt64(-500), nil, []int64{3000, 10000, 25000, 30000, 50000}},
			{"max en 0 se trata como sin tope", nil, ptrInt64(0), []int64{3000, 10000, 25000, 30000, 50000}},
			{"max negativo no filtra", nil, ptrInt64(-1), []int64{3000, 10000, 25000, 30000, 50000}},
		}

		for _, tc := range casos {
			t.Run(tc.nombre, func(t *testing.T) {
				resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
					Page: 1, Limit: 10, CategoriaId: &catID, MinPrice: tc.min, MaxPrice: tc.max,
				})
				require.NoError(t, err)
				assert.ElementsMatch(t, tc.want, preciosDe(resp.Publications))
				assert.EqualValues(t, len(tc.want), resp.Meta.TotalRecords)
			})
		}
	})

	t.Run("rango invertido devuelve lista vacia sin error", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoOferta, 20000)
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 10, CategoriaId: &catID, MinPrice: ptrInt64(50000), MaxPrice: ptrInt64(10000),
		})
		require.NoError(t, err)
		assert.NotNil(t, resp.Publications)
		assert.Empty(t, resp.Publications)
		assert.EqualValues(t, 0, resp.Meta.TotalRecords)
		assert.EqualValues(t, 0, resp.Meta.TotalPages)
	})

	t.Run("la paginacion respeta el filtro de precio", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		for _, precio := range []int64{1000, 2000, 3000, 4000, 5000, 90000} {
			seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoOferta, precio)
		}
		srv := NewPublicationServiceServer(db)
		catID := uint32(cat.IDCategoria)

		// 5 publicaciones cumplen max_price=5000 (la de 90000 queda fuera del total)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 2, CategoriaId: &catID, MaxPrice: ptrInt64(5000),
		})
		require.NoError(t, err)
		assert.Len(t, resp.Publications, 2)
		assert.EqualValues(t, 5, resp.Meta.TotalRecords)
		assert.EqualValues(t, 3, resp.Meta.TotalPages)

		ultima, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 3, Limit: 2, CategoriaId: &catID, MaxPrice: ptrInt64(5000),
		})
		require.NoError(t, err)
		assert.Len(t, ultima.Publications, 1)
	})

	t.Run("combina categoria, tipo, precio y exclusion de usuario", func(t *testing.T) {
		db := setupTestDB(t)
		cat := seedCategoria(t, db)
		seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoOferta, 20000)  // descartada: es OFERTA
		seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoDemanda, 20000) // la única que cumple todo
		seedPublicacionCon(t, db, cat.IDCategoria, 2, models.TipoDemanda, 20000) // descartada: vendedor excluido
		seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoDemanda, 5000)  // descartada: bajo el mínimo
		seedPublicacionCon(t, db, cat.IDCategoria, 1, models.TipoDemanda, 90000) // descartada: sobre el máximo
		srv := NewPublicationServiceServer(db)

		catID := uint32(cat.IDCategoria)
		tipo := pb.TipoServicio_DEMANDA
		excludeID := uint32(2)
		resp, err := srv.ListPublications(context.Background(), &pb.ListPublicationsRequest{
			Page: 1, Limit: 10,
			CategoriaId: &catID, TipoServicio: &tipo, ExcludeUserId: &excludeID,
			MinPrice: ptrInt64(10000), MaxPrice: ptrInt64(50000),
		})
		require.NoError(t, err)
		require.Len(t, resp.Publications, 1)
		assert.EqualValues(t, 20000, resp.Publications[0].PrecioBase)
		assert.EqualValues(t, 1, resp.Publications[0].IdUsuarioVendedor)
		assert.Equal(t, pb.TipoServicio_DEMANDA, resp.Publications[0].TipoServicio)
		assert.EqualValues(t, 1, resp.Meta.TotalRecords)
	})
}