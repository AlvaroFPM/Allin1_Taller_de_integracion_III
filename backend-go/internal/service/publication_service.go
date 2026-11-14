package service

import (
	"context"
	"errors"
	"math"

	pb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/publication"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
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

	tipoServicio, err := protoTipoToModel(req.GetTipoServicio())
	if err != nil {
		return nil, err
	}

	// SEGURIDAD: Sobrescribir el id_usuario_vendedor del body con el ID real del token JWT
	userIDCtx := ctx.Value(middleware.UserIDKey)
	var vendedorID uint
	if userIDCtx != nil {
		vendedorID = userIDCtx.(uint)
	} else {
		// Fallback (no debería pasar por el interceptor, pero por seguridad)
		vendedorID = uint(req.GetIdUsuarioVendedor())
	}

	nuevaPublicacion := models.Publicacion{
		IDUsuarioVendedor: vendedorID,
		CategoriaID:       uint(req.GetCategoriaId()),
		Titulo:            req.GetTitulo(),
		Descripcion:       req.GetDescripcion(),
		TipoServicio:      tipoServicio,
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
		return nil, status.Error(codes.InvalidArgument, "id de publicación inválido")
	}

	var pub models.Publicacion
	err := s.db.WithContext(ctx).
		Preload("Categoria").
		Where("id_publicacion = ?", req.GetIdPublicacion()).
		First(&pub).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, status.Error(codes.NotFound, "publicación no encontrada")
		}
		return nil, status.Errorf(codes.Internal, "error al consultar publicación: %v", err)
	}

	return &pb.GetPublicationResponse{
		Publication: mapModelToProto(&pub),
		Vendedor:    buildSellerSummary(&pub),
	}, nil
}

// GetCategories retorna todas las categorías disponibles, ordenadas alfabéticamente
func (s *PublicationServiceServer) GetCategories(ctx context.Context, req *pb.GetCategoriesRequest) (*pb.GetCategoriesResponse, error) {
	var categorias []models.Categoria
	if err := s.db.WithContext(ctx).Order("nombre ASC").Find(&categorias).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al obtener categorías: %v", err)
	}

	protoCategories := make([]*pb.Category, 0, len(categorias))
	for i := range categorias {
		protoCategories = append(protoCategories, mapCategoriaToProto(&categorias[i]))
	}

	return &pb.GetCategoriesResponse{
		Categories: protoCategories,
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

	// Consulta base: parte de una sesión de GORM y acumula los filtros opcionales.
	// No accede a la base de datos hasta ejecutar Count y Find.
	baseQuery := s.db.WithContext(ctx).Session(&gorm.Session{}).
		Model(&models.Publicacion{}).
		Where("estado = ?", models.EstadoActivo)

	// Filtros opcionales
	if req.CategoriaId != nil && *req.CategoriaId > 0 {
		baseQuery = baseQuery.Where("id_categoria = ?", *req.CategoriaId)
	}

	if req.TipoServicio != nil && *req.TipoServicio != pb.TipoServicio_TIPO_SERVICIO_UNSPECIFIED {
		tipoServicio, err := protoTipoToModel(*req.TipoServicio)
		if err == nil {
			baseQuery = baseQuery.Where("tipo_servicio = ?", tipoServicio)
		}
	}

	// Filtro por usuario vendedor (para vista de perfil / mis publicaciones)
	if req.UserId != nil && *req.UserId > 0 {
		baseQuery = baseQuery.Where("id_usuario_vendedor = ?", *req.UserId)
	} else {
		// Prioridad: ID del token JWT (si el interceptor lo inyectó en el contexto).
		// Respaldo: parámetro opcional exclude_user_id (visitantes sin sesión o clientes que lo envían).
		var excludeUserID uint
		if id, ok := ctx.Value(middleware.UserIDKey).(uint); ok && id > 0 {
			excludeUserID = id
		} else if req.ExcludeUserId != nil && *req.ExcludeUserId > 0 {
			excludeUserID = uint(*req.ExcludeUserId)
		}
		if excludeUserID > 0 {
			baseQuery = baseQuery.Where("id_usuario_vendedor <> ?", excludeUserID)
		}
	}

	// un valor <= 0 se trata como "sin límite". Si min > max el resultado queda vacío.
	if req.MinPrice != nil && *req.MinPrice > 0 {
		baseQuery = baseQuery.Where("precio_base >= ?", *req.MinPrice)
	}
	if req.MaxPrice != nil && *req.MaxPrice > 0 {
		baseQuery = baseQuery.Where("precio_base <= ?", *req.MaxPrice)
	}

	var totalRecords int64
	if err := baseQuery.Count(&totalRecords).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "error al contar publicaciones: %v", err)
	}

	var publicaciones []models.Publicacion
	err := baseQuery.
		Preload("Categoria").
		Order("fecha_creacion DESC, id_publicacion DESC"). // desempate estable: evita repetidos/saltos entre páginas
		Offset(offset).
		Limit(int(limit)).
		Find(&publicaciones).Error

	if err != nil {
		return nil, status.Errorf(codes.Internal, "error al listar publicaciones: %v", err)
	}

	totalPages := int32(math.Ceil(float64(totalRecords) / float64(limit)))

	// Se inicializa con make() para devolver una lista vacía (y no nil) cuando no hay resultados.
	protoPublications := make([]*pb.Publication, 0, len(publicaciones))
	for i := range publicaciones {
		protoPublications = append(protoPublications, mapModelToProto(&publicaciones[i]))
	}

	return &pb.ListPublicationsResponse{
		Publications: protoPublications,
		Meta: &pb.PaginationMeta{
			TotalRecords: totalRecords,
			CurrentPage:  page,
			TotalPages:   totalPages,
			Limit:        limit,
		},
	}, nil
}