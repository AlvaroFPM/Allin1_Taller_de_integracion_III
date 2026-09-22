package media

import (
	"github.com/gabriel-vasile/mimetype"
)

const (
	// DefaultMaxFileSize es el límite de 5MB por archivo (HDU de validadores).
	DefaultMaxFileSize int64 = 5 << 20 // 5 * 1024 * 1024

	// DefaultMaxFiles limita cuántos archivos acepta una sola petición.
	DefaultMaxFiles = 10

	// sniffLen son los bytes que se le pasan al detector. Todos los formatos
	// soportados tienen su firma en la cabecera, así que no hace falta más.
	sniffLen = 3072
)

type ValidatorConfig struct {
	MaxFileSize    int64
	MaxFiles       int
	AllowedFormats []Format
}

func DefaultValidatorConfig() ValidatorConfig {
	return ValidatorConfig{
		MaxFileSize:    DefaultMaxFileSize,
		MaxFiles:       DefaultMaxFiles,
		AllowedFormats: []Format{FormatJPEG, FormatPNG, FormatWEBP, FormatAVIF},
	}
}

// FileValidator valida archivos en memoria. No conoce HTTP: recibe bytes y
// devuelve o un ValidatedFile o un *FileError.
type FileValidator struct {
	maxFileSize int64
	maxFiles    int
	allowed     []Format
}

func NewFileValidator(cfg ValidatorConfig) *FileValidator {
	if cfg.MaxFileSize <= 0 {
		cfg.MaxFileSize = DefaultMaxFileSize
	}
	if cfg.MaxFiles <= 0 {
		cfg.MaxFiles = DefaultMaxFiles
	}
	if len(cfg.AllowedFormats) == 0 {
		cfg.AllowedFormats = DefaultValidatorConfig().AllowedFormats
	}

	allowed := make([]Format, len(cfg.AllowedFormats))
	copy(allowed, cfg.AllowedFormats)

	return &FileValidator{
		maxFileSize: cfg.MaxFileSize,
		maxFiles:    cfg.MaxFiles,
		allowed:     allowed,
	}
}

// MaxFileSize expone el límite configurado para que el handler pueda montar un
// http.MaxBytesReader coherente antes de leer el cuerpo.
func (v *FileValidator) MaxFileSize() int64 { return v.maxFileSize }

// MaxFiles expone el límite de cantidad de archivos, para el mismo propósito
// que MaxFileSize: el handler multiplica ambos para fijar el tope total del
// cuerpo de la petición.
func (v *FileValidator) MaxFiles() int { return v.maxFiles }

// Validate verifica un archivo: que no esté vacío, que no exceda el peso
// máximo y que sus magic bytes correspondan a un formato permitido.
func (v *FileValidator) Validate(f File) (ValidatedFile, error) {
	size := f.Size()

	if size == 0 {
		return ValidatedFile{}, &FileError{FileName: f.Name, Size: 0, Err: ErrEmptyFile}
	}

	if size > v.maxFileSize {
		return ValidatedFile{}, &FileError{FileName: f.Name, Size: size, Err: ErrFileTooLarge}
	}

	head := f.Data
	if len(head) > sniffLen {
		head = head[:sniffLen]
	}

	// Detect lee la firma binaria real. Un .png renombrado a .jpg, o un PDF con
	// Content-Type "image/png" declarado por el cliente, caen aquí.
	mtype := mimetype.Detect(head)

	for _, format := range v.allowed {
		if mtype.Is(string(format)) {
			return ValidatedFile{File: f, Format: format}, nil
		}
	}

	return ValidatedFile{}, &FileError{
		FileName: f.Name,
		Detected: mtype.String(),
		Size:     size,
		Err:      ErrUnsupportedFormat,
	}
}

// ValidateAll valida un lote completo y falla al primer archivo inválido.
func (v *FileValidator) ValidateAll(files []File) ([]ValidatedFile, error) {
	if len(files) == 0 {
		return nil, ErrNoFiles
	}

	if len(files) > v.maxFiles {
		return nil, ErrTooManyFiles
	}

	out := make([]ValidatedFile, 0, len(files))
	for _, f := range files {
		vf, err := v.Validate(f)
		if err != nil {
			return nil, err
		}
		out = append(out, vf)
	}

	return out, nil
}