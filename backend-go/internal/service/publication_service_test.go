package service

import (
	"strings"
	"testing"

	pb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateCreateRequest() error = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantErr {
				st, ok := status.FromError(err)
				if !ok {
					t.Fatalf("el error retornado no es un gRPC status error: %v", err)
				}
				if st.Code() != codes.InvalidArgument {
					t.Errorf("código = %v, esperado %v", st.Code(), codes.InvalidArgument)
				}
				if !strings.Contains(st.Message(), tt.expectedErr) {
					t.Errorf("mensaje = %q, se esperaba que contuviera %q", st.Message(), tt.expectedErr)
				}
			}
		})
	}
}

func TestMappers(t *testing.T) {
	t.Run("Conversión protoTipoToModel", func(t *testing.T) {
		tipo, err := protoTipoToModel(pb.TipoServicio_OFERTA)
		if err != nil || tipo != models.TipoOferta {
			t.Errorf("esperado %s, obtenido %s con error: %v", models.TipoOferta, tipo, err)
		}

		tipo, err = protoTipoToModel(pb.TipoServicio_DEMANDA)
		if err != nil || tipo != models.TipoDemanda {
			t.Errorf("esperado %s, obtenido %s con error: %v", models.TipoDemanda, tipo, err)
		}

		_, err = protoTipoToModel(pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED)
		if err == nil {
			t.Error("esperaba error al convertir TIPO_SERVICIO_UNSPECIFIED, pero obtuvo nil")
		}
	})

	t.Run("Conversión modelTipoToProto", func(t *testing.T) {
		if modelTipoToProto(models.TipoOferta) != pb.TipoServicio_OFERTA {
			t.Errorf("esperado pb.TipoServicio_OFERTA")
		}
		if modelTipoToProto(models.TipoDemanda) != pb.TipoServicio_DEMANDA {
			t.Errorf("esperado pb.TipoServicio_DEMANDA")
		}
		if modelTipoToProto("DESCONOCIDO") != pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED {
			t.Errorf("esperado pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED ante valor desconocido")
		}
	})

	t.Run("Conversión modelEstadoToProto", func(t *testing.T) {
		if modelEstadoToProto(models.EstadoActivo) != pb.EstadoPublicacion_ACTIVO {
			t.Errorf("esperado pb.EstadoPublicacion_ACTIVO")
		}
		if modelEstadoToProto(models.EstadoPausado) != pb.EstadoPublicacion_PAUSADO {
			t.Errorf("esperado pb.EstadoPublicacion_PAUSADO")
		}
		if modelEstadoToProto(models.EstadoCompletado) != pb.EstadoPublicacion_COMPLETADO {
			t.Errorf("esperado pb.EstadoPublicacion_COMPLETADO")
		}
		if modelEstadoToProto(models.EstadoEliminado) != pb.EstadoPublicacion_ELIMINADO {
			t.Errorf("esperado pb.EstadoPublicacion_ELIMINADO")
		}
		if modelEstadoToProto("OTRO") != pb.EstadoPublicacion_ESTADO_PUBLICACION_UNSPECIFIED {
			t.Errorf("esperado pb.EstadoPublicacion_ESTADO_PUBLICACION_UNSPECIFIED")
		}
	})
}