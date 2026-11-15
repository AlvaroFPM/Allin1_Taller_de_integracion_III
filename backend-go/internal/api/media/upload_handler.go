package media

import (
	"errors"
	"net/http"

	service "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
)

// multipartMemoryBuffer es cuánta memoria usa ParseMultipartForm antes de
// derramar el resto a archivos temporales
const multipartMemoryBuffer = 32 << 20 // 32MB

type UploadHandler struct {
	service *service.UploadService
}

func NewUploadHandler(s *service.UploadService) *UploadHandler {
	return &UploadHandler{service: s}
}

func (h *UploadHandler) Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Método no permitido")
		return
	}

	// Tope total del cuerpo = peso máximo por archivo * cantidad máxima de
	// archivos. Sin esto, alguien puede mandar un body de varios GB y el
	// límite de 5MB del validador llega demasiado tarde: el body entero ya
	// se leyó en RAM al parsear el multipart.
	maxTotal := h.service.MaxFileSize() * int64(h.service.MaxFiles())
	r.Body = http.MaxBytesReader(w, r.Body, maxTotal)

	if err := r.ParseMultipartForm(multipartMemoryBuffer); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "el peso total de la petición excede el límite permitido")
			return
		}
		writeError(w, http.StatusBadRequest, "Error al parsear el formulario: "+err.Error())
		return
	}

	fileHeaders := r.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		writeError(w, http.StatusBadRequest, "No se recibió ningún archivo")
		return
	}

	result, err := h.service.ProcessFiles(r.Context(), fileHeaders)
	if err != nil {
		status, msg := mapUploadError(err)
		writeError(w, status, msg)
		return
	}

	writeJSON(w, http.StatusOK, result)
}
