package media

import (
	"context"
	"errors"
	"log"
	"mime/multipart"

	"gorm.io/gorm"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
)

var (
	ErrInvalidMediaType      = errors.New("tipo inválido: debe ser PERFIL o PORTADA")
	ErrMediaStoreUnavailable = errors.New("base de datos de media no disponible")
	ErrMediaPersist          = errors.New("no se pudo guardar la referencia de la imagen")
)

// mediaFolders define la carpeta de Cloudinary según el tipo de imagen.
var mediaFolders = map[string]string{
	models.TipoMediaPerfil:  "media/perfil",
	models.TipoMediaPortada: "media/portada",
}

// MediaRepository guarda las referencias de imágenes.
type MediaRepository interface {
	Create(ctx context.Context, m *models.Media) error
}

type gormMediaRepository struct{ db *gorm.DB }

func NewGormMediaRepository(db *gorm.DB) MediaRepository {
	return &gormMediaRepository{db: db}
}

func (r *gormMediaRepository) Create(ctx context.Context, m *models.Media) error {
	return r.db.WithContext(ctx).Create(m).Error
}

// MediaService sube una imagen de perfil o portada y guarda su referencia.
type MediaService struct {
	upload *UploadService
	repo   MediaRepository // nil si no hay BD
}

func NewMediaService(upload *UploadService, repo MediaRepository) *MediaService {
	return &MediaService{upload: upload, repo: repo}
}

func (s *MediaService) MaxFileSize() int64 { return s.upload.MaxFileSize() }

func (s *MediaService) Upload(ctx context.Context, idUsuario uint, tipo string, fh *multipart.FileHeader) (*models.Media, error) {
	// Se valida todo antes de subir a Cloudinary para no dejar imágenes huérfanas.
	if s.repo == nil {
		return nil, ErrMediaStoreUnavailable
	}
	folder, ok := mediaFolders[tipo]
	if !ok {
		return nil, ErrInvalidMediaType
	}

	res, err := s.upload.WithFolder(folder).ProcessFiles(ctx, []*multipart.FileHeader{fh})
	if err != nil {
		return nil, err
	}
	if len(res.Files) != 1 {
		return nil, ErrMediaPersist
	}
	f := res.Files[0]

	m := &models.Media{
		IDUsuario: idUsuario,
		Tipo:      tipo,
		URL:       f.URL,
		PublicID:  f.PublicID,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		// La imagen ya está en Cloudinary; se deja el public_id en el log (borrado: #173).
		log.Printf("error al guardar media (public_id=%s) tras subir a Cloudinary: %v", f.PublicID, err)
		return nil, ErrMediaPersist
	}
	return m, nil
}