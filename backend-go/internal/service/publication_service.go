package service

import (
	"context"
	"errors"
	"math"

	pb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type PublicationServiceServer struct {
	pb.UnimplementedPublicationServiceServer
	db *gorm.DB
}

func NewPublicationServiceServer(db *gorm.DB) *PublicationServiceServer {
	return &PublicationServiceServer{db: db}
}

// CreatePublication valida y persiste una publicación
func (s *PublicationServiceServer) CreatePublication(ctx context.Context, req *pb.CreatePublicationRequest) (*pb.CreatePublicationResponse, error) {
	// 1. Validación de reglas de negocio en función pura
	if err := validateCreateRequest(req); err != nil {
		return nil, err
	}

	tipoStr, err := protoTipoToModel(req.GetTipoServicio())
	if err != nil {
		return nil, err
	}

	nuevaPublicacion := models.Publicacion{
		IDUsuarioVendedor: uint(req.GetIdUsuarioVendedor()),
		CategoriaID:       uint(req.GetCategoriaId()),
		Titulo:            req.GetTitulo(),
		Descripcion:       req.GetDescripcion(),
		TipoServicio:      tipoStr,
		PrecioBase:        req.GetPrecioBase(),
		Ciudad:            req.GetCiudad(),
		Region:            req.GetRegion(),
		Estado:            models.EstadoActivo,
	}

	if err := s.db.WithContext(ctx).Create(&nuevaPublicacion).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al guardar la publicación: %v", err)
	}

	_ = s.db.WithContext(ctx).Preload("Categoria").First(&nuevaPublicacion, nuevaPublicacion.IDPublicacion)

	return &pb.CreatePublicationResponse{
		Publication: mapModelToProto(&nuevaPublicacion),
		Message:     "Publicación creada exitosamente",
	}, nil
}

// GetPublication consulta una publicación por ID
func (s *PublicationServiceServer) GetPublication(ctx context.Context, req *pb.GetPublicationRequest) (*pb.GetPublicationResponse, error) {
	if req.GetIdPublicacion() == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "id de publicación inválido")
	}

	var pub models.Publicacion
	err := s.db.WithContext(ctx).
		Preload("Categoria").
		Where("id_publicacion = ?", req.GetIdPublicacion()).
		First(&pub).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, status.Errorf(codes.NotFound, "publicación no encontrada")
		}
		return nil, status.Errorf(codes.Internal, "error al consultar publicación: %v", err)
	}

	return &pb.GetPublicationResponse{
		Publication: mapModelToProto(&pub),
	}, nil
}

// ListPublications consulta publicaciones activas paginadas con filtros opcionales
func (s *PublicationServiceServer) ListPublications(ctx context.Context, req *pb.ListPublicationsRequest) (*pb.ListPublicationsResponse, error) {
	page := req.GetPage()
	if page < 1 {
		page = 1
	}

	limit := req.GetLimit()
	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := int((page - 1) * limit)

	query := s.db.WithContext(ctx).Model(&models.Publicacion{}).Where("estado = ?", models.EstadoActivo)

	// Filtros opcionales
	if req.CategoriaId != nil && *req.CategoriaId > 0 {
		query = query.Where("id_categoria = ?", *req.CategoriaId)
	}

	if req.TipoServicio != nil && *req.TipoServicio != pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED {
		tipoStr, err := protoTipoToModel(*req.TipoServicio)
		if err == nil {
			query = query.Where("tipo_servicio = ?", tipoStr)
		}
	}

	// RN-12: Excluir publicaciones del usuario en sesión
	if req.ExcludeUserId != nil && *req.ExcludeUserId > 0 {
		query = query.Where("id_usuario_vendedor <> ?", *req.ExcludeUserId)
	}

	var totalRecords int64
	if err := query.Count(&totalRecords).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al contar publicaciones: %v", err)
	}

	var publicaciones []models.Publicacion
	err := query.
		Preload("Categoria").
		Order("fecha_creacion DESC").
		Offset(offset).
		Limit(int(limit)).
		Find(&publicaciones).Error

	if err != nil {
		return nil, status.Errorf(codes.Internal, "error al listar publicaciones: %v", err)
	}

	totalPages := int32(math.Ceil(float64(totalRecords) / float64(limit)))

	var protoList []*pb.Publication
	for i := range publicaciones {
		protoList = append(protoList, mapModelToProto(&publicaciones[i]))
	}

	return &pb.ListPublicationsResponse{
		Publications: protoList,
		Meta: &pb.PaginationMeta{
			TotalRecords: totalRecords,
			CurrentPage:  page,
			TotalPages:   totalPages,
			Limit:        limit,
		},
	}, nil
}