package media

import (
	"context"
	"fmt"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
)

type UploadService struct {
	cld *cloudinary.Cloudinary
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
	return &UploadService{cld: cld}, nil
}

func (s *UploadService) ProcessFiles(ctx context.Context, fileHeaders []*multipart.FileHeader) (*models.UploadResult, error) {
	var received []models.FileInfo

	for _, fh := range fileHeaders {
		file, err := fh.Open()
		if err != nil {
			return nil, fmt.Errorf("error al abrir %s: %w", fh.Filename, err)
		}

		uploadResult, err := s.cld.Upload.Upload(ctx, file, uploader.UploadParams{
			Folder: "media_uploads",
		})
		file.Close()

		if err != nil {
			return nil, fmt.Errorf("error al subir %s a cloudinary: %w", fh.Filename, err)
		}

		received = append(received, models.FileInfo{
			Name: fh.Filename,
			Size: fh.Size,
			URL:  uploadResult.SecureURL,
		})
	}

	return &models.UploadResult{Success: true, Files: received}, nil
}