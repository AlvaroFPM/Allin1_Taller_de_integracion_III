//go:build integration

package media_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/joho/godotenv"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

func TestIntegration_SubidaRealACloudinary(t *testing.T) {
	_ = godotenv.Load("../../../.env")

	svc, err := media.NewUploadService()
	if err != nil {
		t.Fatalf("no se pudo inicializar UploadService: %v", err)
	}
	svc = svc.WithFolder("media_uploads_test")

	fileHeaders := buildRealJPEGFileHeaders(t)

	result, err := svc.ProcessFiles(context.Background(), fileHeaders)
	if err != nil {
		t.Fatalf("ProcessFiles falló contra Cloudinary real: %v", err)
	}

	if !result.Success || len(result.Files) != 1 {
		t.Fatalf("resultado inesperado: %+v", result)
	}

	uploaded := result.Files[0]
	if uploaded.URL == "" {
		t.Fatal("se esperaba una URL real de Cloudinary")
	}
	if uploaded.PublicID == "" {
		t.Fatal("se esperaba un PublicID para poder limpiar el asset")
	}
	t.Logf("Subido correctamente: %s (public_id: %s)", uploaded.URL, uploaded.PublicID)

	cleanupCloudinaryAsset(t, uploaded.PublicID)
}

func buildRealJPEGFileHeaders(t *testing.T) []*multipart.FileHeader {
	t.Helper()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	part, err := w.CreateFormFile("files", "integration-test.jpg")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}

	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	for x := 0; x < 32; x++ {
		for y := 0; y < 32; y++ {
			img.Set(x, y, color.RGBA{R: 200, G: 50, B: 50, A: 255})
		}
	}
	if err := jpeg.Encode(part, img, nil); err != nil {
		t.Fatalf("jpeg.Encode: %v", err)
	}
	w.Close()

	req := httptest.NewRequest("POST", "/upload/multiple", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if err := req.ParseMultipartForm(32 << 20); err != nil {
		t.Fatalf("ParseMultipartForm: %v", err)
	}
	return req.MultipartForm.File["files"]
}

func cleanupCloudinaryAsset(t *testing.T, publicID string) {
	t.Helper()

	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		t.Logf("no se pudo limpiar el asset de prueba: %v", err)
		return
	}

	_, err = cld.Upload.Destroy(context.Background(), uploader.DestroyParams{
		PublicID: publicID,
	})
	if err != nil {
		t.Logf("limpieza del asset de prueba falló (no bloquea el test): %v", err)
	}
}