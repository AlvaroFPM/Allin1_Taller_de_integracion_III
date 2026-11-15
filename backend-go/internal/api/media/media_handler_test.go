package media

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	service "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// Dobles exclusivos de pruebas: observan bytes, carpetas y orden sin red ni BD.
type recordingMediaUploader struct {
	folders    []string
	dimensions []image.Point
	events     *[]string
	fail       bool
}

func (u *recordingMediaUploader) Upload(_ context.Context, file interface{}, params uploader.UploadParams) (*uploader.UploadResult, error) {
	*u.events = append(*u.events, "upload")
	u.folders = append(u.folders, params.Folder)
	if u.fail {
		return nil, errors.New("proveedor no disponible")
	}
	img, _, err := image.Decode(file.(io.Reader))
	if err != nil {
		return nil, err
	}
	u.dimensions = append(u.dimensions, img.Bounds().Size())
	return &uploader.UploadResult{SecureURL: "https://example.test/image.jpg", PublicID: "media/test"}, nil
}

type recordingMediaRepository struct {
	saved  []models.Media
	events *[]string
	fail   bool
}

func (r *recordingMediaRepository) Create(_ context.Context, m *models.Media) error {
	*r.events = append(*r.events, "persist")
	r.saved = append(r.saved, *m)
	if r.fail {
		return errors.New("fallo de BD no expuesto")
	}
	m.IDMedia = 42
	return nil
}

func TestMediaHandle_ContratoYPersistencia(t *testing.T) {
	jpg := jpegBytes(t, 2000, 1000)
	cases := []struct {
		name, tipo, method                    string
		files                                 int
		user, noRepo, failUpload, failPersist bool
		data                                  []byte
		status                                int
		message, folder                       string
		size                                  image.Point
		events                                []string
	}{
		{name: "perfil", tipo: " perfil ", files: 1, user: true, status: 201, folder: "media/perfil", size: image.Pt(512, 256), events: []string{"upload", "persist"}},
		{name: "portada", tipo: " portada ", files: 1, user: true, status: 201, folder: "media/portada", size: image.Pt(1600, 800), events: []string{"upload", "persist"}},
		{name: "sin usuario", tipo: "PERFIL", files: 1, status: 401, message: "usuario no autenticado"},
		{name: "metodo", method: "GET", status: 405, message: "Método no permitido"},
		{name: "tipo invalido", tipo: "OTRO", files: 1, user: true, status: 400, message: service.ErrInvalidMediaType.Error()},
		{name: "repositorio ausente", tipo: "PERFIL", files: 1, user: true, noRepo: true, status: 503, message: service.ErrMediaStoreUnavailable.Error()},
		{name: "repositorio antes del tipo", tipo: "OTRO", files: 1, user: true, noRepo: true, status: 503, message: service.ErrMediaStoreUnavailable.Error()},
		{name: "sin archivo", tipo: "PERFIL", user: true, status: 400, message: "se debe enviar exactamente un archivo en el campo 'file'"},
		{name: "dos archivos", tipo: "PERFIL", files: 2, user: true, status: 400, message: "se debe enviar exactamente un archivo en el campo 'file'"},
		{name: "formato invalido", tipo: "PERFIL", files: 1, user: true, data: []byte("texto"), status: 415, message: "\"foto.jpg\" (text/plain; charset=utf-8, 5 bytes): media: el contenido real del archivo no es una imagen soportada"},
		{name: "fallo proveedor", tipo: "PERFIL", files: 1, user: true, failUpload: true, status: 500, message: "Error al procesar archivos: error al subir foto.jpg a cloudinary: proveedor no disponible", events: []string{"upload"}},
		{name: "fallo persistencia", tipo: "PERFIL", files: 1, user: true, failPersist: true, status: 500, message: "Error al procesar archivos: " + service.ErrMediaPersist.Error(), events: []string{"upload", "persist"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var events []string
			up := &recordingMediaUploader{events: &events, fail: tc.failUpload}
			repo := &recordingMediaRepository{events: &events, fail: tc.failPersist}
			var repository service.MediaRepository = repo
			if tc.noRepo {
				repository = nil
			}
			upload := service.NewUploadServiceWithDeps(up, service.NewFileValidator(service.DefaultValidatorConfig()), service.NewImageProcessor(service.DefaultProcessorConfig()))
			handler := NewMediaHandler(service.NewMediaService(upload, repository))
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			if err := writer.WriteField("tipo", tc.tipo); err != nil {
				t.Fatal(err)
			}
			for i := 0; i < tc.files; i++ {
				part, err := writer.CreateFormFile("file", "foto.jpg")
				if err != nil {
					t.Fatal(err)
				}
				data := jpg
				if tc.data != nil {
					data = tc.data
				}
				if _, err := part.Write(data); err != nil {
					t.Fatal(err)
				}
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			method := tc.method
			if method == "" {
				method = http.MethodPost
			}
			req := httptest.NewRequest(method, "/v1/media/upload", &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			if tc.user {
				req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, uint(7)))
			}
			rec := httptest.NewRecorder()
			handler.Handle(rec, req)
			if req.MultipartForm != nil {
				defer req.MultipartForm.RemoveAll()
			}
			if rec.Code != tc.status {
				t.Fatalf("status=%d, want=%d: %s", rec.Code, tc.status, rec.Body.String())
			}
			if rec.Header().Get("Content-Type") != "application/json" {
				t.Fatal("Content-Type alterado")
			}
			if !reflect.DeepEqual(events, tc.events) {
				t.Fatalf("efectos=%v, want=%v", events, tc.events)
			}
			var got map[string]interface{}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if tc.status != http.StatusCreated {
				if !reflect.DeepEqual(got, map[string]interface{}{"error": tc.message}) {
					t.Fatalf("error JSON=%v", got)
				}
				return
			}
			tipo := "PERFIL"
			if tc.name == "portada" {
				tipo = "PORTADA"
			}
			want := map[string]interface{}{"id": float64(42), "tipo": tipo, "url": "https://example.test/image.jpg", "publicId": "media/test"}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("JSON=%v, want=%v", got, want)
			}
			if len(repo.saved) != 1 || repo.saved[0].IDUsuario != 7 || repo.saved[0].Tipo != tipo || repo.saved[0].URL != want["url"] || repo.saved[0].PublicID != want["publicId"] {
				t.Fatalf("persistencia=%+v", repo.saved)
			}
			if !reflect.DeepEqual(up.folders, []string{tc.folder}) || !reflect.DeepEqual(up.dimensions, []image.Point{tc.size}) {
				t.Fatalf("carpetas=%v, dimensiones=%v", up.folders, up.dimensions)
			}

			// El endpoint de lote comparte servicio: la política específica no debe mutarlo.
			multiple := multipartRequest(t, map[string][]byte{"foto.jpg": jpg})
			multipleRec := httptest.NewRecorder()
			NewUploadHandler(upload).Handle(multipleRec, multiple)
			if multiple.MultipartForm != nil {
				defer multiple.MultipartForm.RemoveAll()
			}
			if multipleRec.Code != 200 || len(up.folders) != 2 || up.folders[1] != "media_uploads" || up.dimensions[1] != image.Pt(1920, 960) {
				t.Fatalf("servicio compartido alterado: %d %v %v", multipleRec.Code, up.folders, up.dimensions)
			}
		})
	}
}
