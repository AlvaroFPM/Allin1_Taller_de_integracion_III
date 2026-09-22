package media

import (
	"errors"
	"fmt"
)

// Errores de dominio. El paquete media no conoce HTTP ni gRPC: es la capa
// internal/api/ la que traduce estos errores a status codes.
//	ErrEmptyFile, ErrUnsupportedFormat -> 400 / codes.InvalidArgument
//	ErrFileTooLarge                    -> 413 / codes.InvalidArgument
//	ErrTooManyFiles                    -> 400 / codes.InvalidArgument
//	ErrNoFiles                         -> 400 / codes.InvalidArgument
var (
	ErrNoFiles           = errors.New("media: no se recibió ningún archivo")
	ErrEmptyFile         = errors.New("media: el archivo está vacío")
	ErrFileTooLarge      = errors.New("media: el archivo excede el peso máximo permitido")
	ErrUnsupportedFormat = errors.New("media: el contenido real del archivo no es una imagen soportada")
	ErrTooManyFiles      = errors.New("media: la petición contiene demasiados archivos")
)

// FileError asocia un error de dominio con el archivo concreto que lo provocó,
// para que el cliente sepa cuál de los N archivos del multipart falló.
// Implementa Unwrap, así que errors.Is(err, ErrFileTooLarge) sigue funcionando.
type FileError struct {
	// FileName es el nombre declarado por el cliente. Nunca se usa para decidir
	// nada: es solo informativo para el mensaje de error.
	FileName string

	// Detected es el MIME real detectado por magic bytes, si se llegó a detectar.
	Detected string

	// Size es el peso en bytes del archivo recibido.
	Size int64

	Err error
}

func (e *FileError) Error() string {
	if e.Detected != "" {
		return fmt.Sprintf("%q (%s, %d bytes): %v", e.FileName, e.Detected, e.Size, e.Err)
	}
	return fmt.Sprintf("%q (%d bytes): %v", e.FileName, e.Size, e.Err)
}

func (e *FileError) Unwrap() error { return e.Err }
