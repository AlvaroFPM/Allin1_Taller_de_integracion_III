package media

import (
	"errors"
	"net/http"
	"strings"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	service "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

// multipartOverhead es el margen del body por encima del peso máximo del archivo.
const multipartOverhead = 1 << 20

type MediaHandler struct {
	service *service.MediaService
}

func NewMediaHandler(s *service.MediaService) *MediaHandler {
	return &MediaHandler{service: s}
}

type mediaResponse struct {
	ID       uint   `json:"id"`
	Tipo     string `json:"tipo"`
	URL      string `json:"url"`
	PublicID string `json:"publicId"`
}

// Handle atiende POST /v1/media/upload (multipart: campos "tipo" y "file").
// Debe ir detrás de middleware.HTTPAuth.
func (h *MediaHandler) Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Método no permitido")
		return
	}

	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		writeError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, h.service.MaxFileSize()+(multipartOverhead))
	if err := r.ParseMultipartForm(multipartMemoryBuffer); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "el archivo excede el límite permitido")
			return
		}
		writeError(w, http.StatusBadRequest, "Error al parsear el formulario: "+err.Error())
		return
	}

	tipo := strings.ToUpper(strings.TrimSpace(r.FormValue("tipo")))

	headers := r.MultipartForm.File["file"]
	if len(headers) != 1 {
		writeError(w, http.StatusBadRequest, "se debe enviar exactamente un archivo en el campo 'file'")
		return
	}

	m, err := h.service.Upload(r.Context(), userID, tipo, headers[0])
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidMediaType):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrMediaStoreUnavailable):
			writeError(w, http.StatusServiceUnavailable, err.Error())
		default:
			status, msg := mapUploadError(err)
			writeError(w, status, msg)
		}
		return
	}

	writeJSON(w, http.StatusCreated, mediaResponse{ID: m.IDMedia, Tipo: m.Tipo, URL: m.URL, PublicID: m.PublicID})
}