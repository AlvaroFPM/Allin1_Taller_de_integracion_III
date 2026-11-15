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

// mediaPolicies mantiene juntas la carpeta y la dimensión máxima de cada tipo.
var mediaPolicies = map[string]struct {
	folder       string
	maxDimension int
}{
	models.TipoMediaPerfil:  {folder: "media/perfil", maxDimension: 512},
	models.TipoMediaPortada: {folder: "media/portada", maxDimension: 1600},
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
	// Comprobar repositorio y tipo antes de subir. Un fallo posterior de
	// persistencia todavía puede dejar una imagen huérfana en Cloudinary.
	if s.repo == nil {
		return nil, ErrMediaStoreUnavailable
	}
	policy, ok := mediaPolicies[tipo]
	if !ok {
		return nil, ErrInvalidMediaType
	}

	uploadResult, err := s.upload.WithFolder(policy.folder).WithMaxDimension(policy.maxDimension).ProcessFiles(ctx, []*multipart.FileHeader{fh})
	if err != nil {
		return nil, err
	}
	if len(uploadResult.Files) != 1 {
		return nil, ErrMediaPersist
	}
	uploadedFile := uploadResult.Files[0]

	mediaRecord := &models.Media{
		IDUsuario: idUsuario,
		Tipo:      tipo,
		URL:       uploadedFile.URL,
		PublicID:  uploadedFile.PublicID,
	}
	if err := s.repo.Create(ctx, mediaRecord); err != nil {
		// La imagen ya está en Cloudinary; se deja el public_id en el log (borrado: #173).
		log.Printf("error al guardar media (public_id=%s) tras subir a Cloudinary: %v", uploadedFile.PublicID, err)
		return nil, ErrMediaPersist
	}
	return mediaRecord, nil
}
