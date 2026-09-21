package media

import "strings"

// Format es un formato de imagen soportado, identificado por su MIME real
// (magic bytes), nunca por la extensión ni por el Content-Type del cliente.
type Format string

const (
	FormatJPEG Format = "image/jpeg"
	FormatPNG  Format = "image/png"
	FormatWEBP Format = "image/webp"
	FormatAVIF Format = "image/avif"
)

// NeedsTranscoding indica si el procesador debe decodificar y recomprimir el archivo antes de subirlo.
func (f Format) NeedsTranscoding() bool {
	return f != FormatAVIF
}

// Extension devuelve la extensión canónica del formato, con punto.
func (f Format) Extension() string {
	switch f {
	case FormatJPEG:
		return ".jpg"
	case FormatPNG:
		return ".png"
	case FormatWEBP:
		return ".webp"
	case FormatAVIF:
		return ".avif"
	default:
		return ""
	}
}

func (f Format) String() string { return string(f) }

// File es un archivo ya cargado en memoria.
type File struct {
	// Name es el nombre declarado por el cliente. Se trata como dato no confiable.
	Name string
	Data []byte
}

func (f File) Size() int64 { return int64(len(f.Data)) }

// ValidatedFile es un File que ya pasó por el validador.
type ValidatedFile struct {
	File
	Format Format
}

// ExtensionMismatch reporta si la extensión declarada por el cliente no corresponde al contenido real.
func (v ValidatedFile) ExtensionMismatch() bool {
	name := strings.ToLower(v.Name)
	switch v.Format {
	case FormatJPEG:
		return !strings.HasSuffix(name, ".jpg") && !strings.HasSuffix(name, ".jpeg")
	default:
		return !strings.HasSuffix(name, v.Format.Extension())
	}
}
