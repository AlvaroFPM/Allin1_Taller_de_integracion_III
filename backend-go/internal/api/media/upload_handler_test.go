package media

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/cloudinary/cloudinary-go/v2/api/uploader"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	service "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

// --- Mock de Cloudinary -----------------------------------------------
//
// Implementa service.CloudinaryUploader con la MISMA firma que el SDK real
// (file interface{}, no io.Reader) para que sea intercambiable sin wrappers.
// No toca red: cada llamada devuelve una URL fabricada.

type fakeUploader struct {
	calls    int
	failWith error
}

func (f *fakeUploader) Upload(_ context.Context, _ interface{}, _ uploader.UploadParams) (*uploader.UploadResult, error) {
	if f.failWith != nil {
		return nil, f.failWith
	}
	f.calls++
	return &uploader.UploadResult{
		SecureURL: fmt.Sprintf("https://res.cloudinary.com/demo/image/upload/fake-%d.jpg", f.calls),
	}, nil
}

// --- Helpers de test -------------------------------------------------

func newTestHandler(cldUploader service.CloudinaryUploader, validator *service.FileValidator) *UploadHandler {
	if validator == nil {
		validator = service.NewFileValidator(service.DefaultValidatorConfig())
	}
	svc := service.NewUploadServiceWithDeps(cldUploader, validator, service.NewImageProcessor(service.DefaultProcessorConfig()))
	return NewUploadHandler(svc)
}

// multipartRequest arma una petición POST multipart real, tal como la
// mandaría un cliente, con un campo "files" por cada entrada del mapa.
func multipartRequest(t *testing.T, files map[string][]byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for name, data := range files {
		part, err := w.CreateFormFile("files", name)
		if err != nil {
			t.Fatalf("CreateFormFile: %v", err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatalf("Write: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/upload/multiple", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func jpegBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	// Gradiente por bloques: tiene suficiente variación para no comprimir a
	// un tamaño trivial (como pasaría con un color sólido), pero sin el
	// ruido de alta frecuencia pixel a pixel que infla el peso muchísimo más
	// de lo que pesaría una foto real.
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x / 16) % 256),
				G: uint8((y / 16) % 256),
				B: uint8(((x + y) / 32) % 256),
				A: 255,
			})
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 75}); err != nil {
		t.Fatalf("jpeg.Encode: %v", err)
	}
	return out.Bytes()
}

func decodeResult(t *testing.T, rec *httptest.ResponseRecorder) models.UploadResult {
	t.Helper()
	var result models.UploadResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("no se pudo decodificar la respuesta: %v (body: %s)", err, rec.Body.String())
	}
	return result
}

// --- Camino feliz -------------------------------------------------------

func TestHandle_SubidaExitosa(t *testing.T) {
	up := &fakeUploader{}
	h := newTestHandler(up, nil)

	req := multipartRequest(t, map[string][]byte{
		"foto1.jpg": jpegBytes(t, 100, 100),
		"foto2.jpg": jpegBytes(t, 4000, 3000), // fuerza resize en el procesador
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, se esperaba 200; body = %s", rec.Code, rec.Body.String())
	}
	if up.calls != 2 {
		t.Errorf("se esperaban 2 subidas a cloudinary, hubo %d", up.calls)
	}

	result := decodeResult(t, rec)
	if !result.Success {
		t.Error("Success debería ser true")
	}
	if len(result.Files) != 2 {
		t.Fatalf("len(Files) = %d, se esperaban 2", len(result.Files))
	}
	for _, f := range result.Files {
		if f.URL == "" {
			t.Errorf("%s: URL vacía en la respuesta", f.Name)
		}
	}
}

// --- Método no permitido --------------------------------------------------

func TestHandle_MetodoNoPermitido(t *testing.T) {
	h := newTestHandler(&fakeUploader{}, nil)
	req := httptest.NewRequest(http.MethodGet, "/upload/multiple", nil)
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, se esperaba 405", rec.Code)
	}
}

// --- Sin archivos -----------------------------------------------------

func TestHandle_SinArchivos(t *testing.T) {
	h := newTestHandler(&fakeUploader{}, nil)
	req := multipartRequest(t, map[string][]byte{})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, se esperaba 400; body = %s", rec.Code, rec.Body.String())
	}
}

// --- Formato inválido: magic bytes rechazan el contenido -----------------

func TestHandle_FormatoInvalido(t *testing.T) {
	up := &fakeUploader{}
	h := newTestHandler(up, nil)

	req := multipartRequest(t, map[string][]byte{
		"no-es-imagen.jpg": []byte("esto es texto plano, no una imagen"),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, se esperaba 415; body = %s", rec.Code, rec.Body.String())
	}
	if up.calls != 0 {
		t.Error("no debería haberse llamado a cloudinary: el archivo nunca pasó la validación")
	}
}

// --- Un archivo individual excede el peso máximo (413 del validador) -----

func TestHandle_ArchivoIndividualDemasiadoGrande(t *testing.T) {
	up := &fakeUploader{}
	// MaxFileSize=1000, MaxFiles=5 -> maxTotal=5000: el body cabe entero bajo
	// el límite del MaxBytesReader, así que si esto da 413 es por el
	// validador, no por el límite total del cuerpo.
	tinyValidator := service.NewFileValidator(service.ValidatorConfig{MaxFileSize: 1000, MaxFiles: 5})
	h := newTestHandler(up, tinyValidator)

	req := multipartRequest(t, map[string][]byte{
		"grande.bin": bytes.Repeat([]byte{0xAB}, 4000),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, se esperaba 413; body = %s", rec.Code, rec.Body.String())
	}
	if up.calls != 0 {
		t.Error("no debería haberse llamado a cloudinary")
	}
}

// --- El cuerpo total de la petición excede el límite (413 del MaxBytesReader) --

func TestHandle_CuerpoTotalExcedeElLimite(t *testing.T) {
	up := &fakeUploader{}
	// maxTotal = 500*2 = 1000 bytes. El body multipart entero (headers +
	// boundary + contenido) va a superar eso ampliamente.
	tinyValidator := service.NewFileValidator(service.ValidatorConfig{MaxFileSize: 500, MaxFiles: 2})
	h := newTestHandler(up, tinyValidator)

	req := multipartRequest(t, map[string][]byte{
		"grande.bin": bytes.Repeat([]byte{0xCD}, 5000),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, se esperaba 413; body = %s", rec.Code, rec.Body.String())
	}
}

// --- Demasiados archivos en el lote ----------------------------------

func TestHandle_DemasiadosArchivos(t *testing.T) {
	up := &fakeUploader{}
	limitedValidator := service.NewFileValidator(service.ValidatorConfig{MaxFiles: 1})
	h := newTestHandler(up, limitedValidator)

	req := multipartRequest(t, map[string][]byte{
		"a.jpg": jpegBytes(t, 50, 50),
		"b.jpg": jpegBytes(t, 50, 50),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, se esperaba 400; body = %s", rec.Code, rec.Body.String())
	}
	if up.calls != 0 {
		t.Error("todo-o-nada: no debería haberse subido nada del lote")
	}
}

// --- Falla real de Cloudinary: 500, no 400/413 ----------------------------

func TestHandle_FalloDeCloudinary(t *testing.T) {
	up := &fakeUploader{failWith: errors.New("cloudinary: servicio no disponible")}
	h := newTestHandler(up, nil)

	req := multipartRequest(t, map[string][]byte{
		"foto.jpg": jpegBytes(t, 50, 50),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, se esperaba 500; body = %s", rec.Code, rec.Body.String())
	}
}

// --- Todo-o-nada a nivel validación: uno malo tumba el lote entero --------

func TestHandle_LoteConUnArchivoInvalidoNoSubeNinguno(t *testing.T) {
	up := &fakeUploader{}
	h := newTestHandler(up, nil)

	req := multipartRequest(t, map[string][]byte{
		"buena.jpg": jpegBytes(t, 50, 50),
		"mala.jpg":  []byte("no es una imagen"),
	})
	rec := httptest.NewRecorder()

	h.Handle(rec, req)

	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, se esperaba 415; body = %s", rec.Code, rec.Body.String())
	}
	if up.calls != 0 {
		t.Error("todo-o-nada: la imagen válida no debería haberse subido si otra del lote falló")
	}
}