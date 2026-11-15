package media

import (
	"encoding/json"
	"errors"
	service "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media"
	"net/http"
)

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
