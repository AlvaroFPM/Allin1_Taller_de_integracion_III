package service

import (
	"strings"
	"unicode/utf8"

	pb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// validateCreateRequest valida las reglas de negocio de entrada de forma pura (testeable sin BD)
func validateCreateRequest(req *pb.CreatePublicationRequest) error {
	if req.GetIdUsuarioVendedor() == 0 {
		return status.Error(codes.InvalidArgument, "el id de usuario vendedor es obligatorio (RN-11)")
	}
	if req.GetCategoriaId() == 0 {
		return status.Error(codes.InvalidArgument, "la categoría es obligatoria (RN-18)")
	}

	titulo := strings.TrimSpace(req.GetTitulo())
	if utf8.RuneCountInString(titulo) < 5 {
		return status.Error(codes.InvalidArgument, "el título debe tener al menos 5 caracteres (RN-18)")
	}

	descripcion := strings.TrimSpace(req.GetDescripcion())
	descLen := utf8.RuneCountInString(descripcion)
	if descLen < 50 || descLen > 1000 {
		return status.Error(codes.InvalidArgument, "la descripción debe tener entre 50 y 1000 caracteres (RN-19)")
	}

	if req.GetPrecioBase() <= 0 {
		return status.Error(codes.InvalidArgument, "el precio base debe ser un entero mayor a 0 (RN-23)")
	}

	if req.GetTipoServicio() != pb.TipoServicio_OFERTA && req.GetTipoServicio() != pb.TipoServicio_DEMANDA {
		return status.Error(codes.InvalidArgument, "debe seleccionar un tipo de servicio válido: OFERTA o DEMANDA (RN-11)")
	}

	return nil
}

// protoTipoToModel convierte el enum gRPC a string de BD, rechazando valores indefinidos
func protoTipoToModel(t pb.TipoServicio) (string, error) {
	switch t {
	case pb.TipoServicio_OFERTA:
		return models.TipoOferta, nil
	case pb.TipoServicio_DEMANDA:
		return models.TipoDemanda, nil
	default:
		return "", status.Error(codes.InvalidArgument, "tipo de servicio inválido (RN-11)")
	}
}

// modelTipoToProto convierte el string de BD al enum gRPC
func modelTipoToProto(tipo string) pb.TipoServicio {
	switch tipo {
	case models.TipoDemanda:
		return pb.TipoServicio_DEMANDA
	case models.TipoOferta:
		return pb.TipoServicio_OFERTA
	default:
		return pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED
	}
}

// modelEstadoToProto convierte el estado de la BD a su respectivo enum gRPC
func modelEstadoToProto(estado string) pb.EstadoPublicacion {
	switch estado {
	case models.EstadoActivo:
		return pb.EstadoPublicacion_ACTIVO
	case models.EstadoPausado:
		return pb.EstadoPublicacion_PAUSADO
	case models.EstadoCompletado:
		return pb.EstadoPublicacion_COMPLETADO
	case models.EstadoEliminado:
		return pb.EstadoPublicacion_ELIMINADO
	default:
		return pb.EstadoPublicacion_ESTADO_PUBLICACION_UNSPECIFIED
	}
}

// mapModelToProto construye el mensaje gRPC a partir del modelo GORM
func mapModelToProto(m *models.Publicacion) *pb.Publication {
	var protoCategoria *pb.Category
	if m.Categoria.IDCategoria != 0 {
		protoCategoria = &pb.Category{
			IdCategoria: uint32(m.Categoria.IDCategoria),
			Nombre:      m.Categoria.Nombre,
			Slug:        m.Categoria.Slug,
			IconoUrl:    m.Categoria.IconoURL,
		}
	}

	return &pb.Publication{
		IdPublicacion:     uint32(m.IDPublicacion),
		IdUsuarioVendedor: uint32(m.IDUsuarioVendedor),
		CategoriaId:       uint32(m.CategoriaID),
		Titulo:            m.Titulo,
		Descripcion:       m.Descripcion,
		TipoServicio:      modelTipoToProto(m.TipoServicio),
		PrecioBase:        m.PrecioBase,
		Ciudad:            m.Ciudad,
		Region:            m.Region,
		Estado:            modelEstadoToProto(m.Estado),
		Categoria:         protoCategoria,
		CreatedAt:         timestamppb.New(m.CreatedAt),
		UpdatedAt:         timestamppb.New(m.UpdatedAt),
	}
}