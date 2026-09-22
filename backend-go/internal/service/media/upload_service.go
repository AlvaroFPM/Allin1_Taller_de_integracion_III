package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
)

type CloudinaryUploader interface {
	Upload(ctx context.Context, file interface{}, uploadParams uploader.UploadParams) (*uploader.UploadResult, error)
}

type UploadService struct {
	cldUploader CloudinaryUploader
	validator   *FileValidator
	processor   *ImageProcessor
	folder      string
}

func NewUploadService() (*UploadService, error) {
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		return nil, fmt.Errorf("error al inicializar cloudinary: %w", err)
	}

	return NewUploadServiceWithDeps(
		&cld.Upload, // *uploader.API: el método Upload tiene receiver puntero
		NewFileValidator(DefaultValidatorConfig()),
		NewImageProcessor(DefaultProcessorConfig()),
	), nil
}

func NewUploadServiceWithDeps(cldUploader CloudinaryUploader, validator *FileValidator, processor *ImageProcessor) *UploadService {
	return &UploadService{
		cldUploader: cldUploader,
		validator:   validator,
		processor:   processor,
		folder:      "media_uploads",
	}
}

// MaxFileSize y MaxFiles se exponen para que el handler pueda calcular el
// tope total del cuerpo de la petición
func (s *UploadService) MaxFileSize() int64 { return s.validator.MaxFileSize() }
func (s *UploadService) MaxFiles() int      { return s.validator.MaxFiles() }

// WithFolder devuelve una copia del servicio apuntando a otra carpeta de
// Cloudinary — útil para separar subidas de test de las de producción.
func (s *UploadService) WithFolder(folder string) *UploadService {
	clone := *s
	clone.folder = folder
	return &clone
}

// ProcessFiles ejecuta el pipeline completo sobre los archivos ya parseados
// del multipart
func (s *UploadService) ProcessFiles(ctx context.Context, fileHeaders []*multipart.FileHeader) (*models.UploadResult, error) {
	files, err := readMultipartFiles(fileHeaders)
	if err != nil {
		return nil, err
	}

	validated, err := s.validator.ValidateAll(files)
	if err != nil {
		return nil, err
	}

	processed, err := s.processor.ProcessAll(validated)
	if err != nil {
		return nil, err
	}

	uploaded := make([]models.FileInfo, 0, len(processed))
	for _, pf := range processed {
		res, err := s.cldUploader.Upload(ctx, bytes.NewReader(pf.Data), uploader.UploadParams{
			Folder: s.folder,
		})
		if err != nil {
			return nil, fmt.Errorf("error al subir %s a cloudinary: %w", pf.Name, err)
		}
		uploaded = append(uploaded, models.FileInfo{
			Name:     pf.Name,
			Size:     int64(len(pf.Data)),
			URL:      res.SecureURL,
			PublicID: res.PublicID,
		})
	}

	return &models.UploadResult{Success: true, Files: uploaded}, nil
}

// readMultipartFiles convierte cada *multipart.FileHeader en un media.File
// neutral, leyendo todo su contenido a memoria. A partir de aquí el resto del
// pipeline (validador, procesador) no vuelve a saber que existió un
// multipart.
func readMultipartFiles(headers []*multipart.FileHeader) ([]File, error) {
	files := make([]File, 0, len(headers))
	for _, fh := range headers {
		f, err := fh.Open()
		if err != nil {
			return nil, &FileError{FileName: fh.Filename, Size: fh.Size, Err: fmt.Errorf("no se pudo abrir el archivo: %w", err)}
		}

		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			return nil, &FileError{FileName: fh.Filename, Size: fh.Size, Err: fmt.Errorf("no se pudo leer el archivo: %w", err)}
		}

		files = append(files, File{Name: fh.Filename, Data: data})
	}
	return files, nil
}