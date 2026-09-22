package media

import (
	"encoding/json"
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

// mapUploadError traduce los errores de dominio del pipeline
// validación->procesamiento a un status HTTP. Cualquier error no reconocido
// (fallo real de Cloudinary, error de red, etc.) cae en 500: eso es lo único
// que de verdad es "error interno" en este pipeline.
func mapUploadError(err error) (status int, message string) {
	// Los errores por-archivo llegan envueltos en *service.FileError
	// (ErrEmptyFile, ErrFileTooLarge, ErrUnsupportedFormat).
	var fileErr *service.FileError
	if errors.As(err, &fileErr) {
		switch {
		case errors.Is(fileErr, service.ErrFileTooLarge):
			return http.StatusRequestEntityTooLarge, fileErr.Error()
		case errors.Is(fileErr, service.ErrUnsupportedFormat):
			return http.StatusUnsupportedMediaType, fileErr.Error()
		default:
			// ErrEmptyFile y cualquier error de lectura del multipart.
			return http.StatusBadRequest, fileErr.Error()
		}
	}

	// Errores de lote, sin archivo asociado.
	if errors.Is(err, service.ErrNoFiles) || errors.Is(err, service.ErrTooManyFiles) {
		return http.StatusBadRequest, err.Error()
	}

	return http.StatusInternalServerError, "Error al procesar archivos: " + err.Error()
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}