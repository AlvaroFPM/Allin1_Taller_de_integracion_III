package media

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // registra el decoder PNG en image.Decode

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // registra el decoder WEBP en image.Decode
)

const (
	// MaxDimension es el límite del lado más largo, en píxeles
	MaxDimension = 1920

	// JPEGQuality es la calidad de recompresión: sweet spot entre peso y percepción visual para imágenes web.
	JPEGQuality = 82
)

// ProcessedFile es el resultado del procesador: bytes listos para subir a
// Cloudinary, junto con el formato final (para construir el nombre/extensión)
// y si se aplicó transformación o fue passthrough.
type ProcessedFile struct {
	Name          string
	Data          []byte
	Format        Format // formato final tras procesar, no el original
	WasTranscoded bool
}

// ImageProcessor redimensiona y recomprime imágenes en memoria. No conoce
// HTTP ni Cloudinary: recibe un ValidatedFile y devuelve bytes listos para
// subir.
type ImageProcessor struct {
	maxDimension int
	jpegQuality  int
}

type ProcessorConfig struct {
	MaxDimension int
	JPEGQuality  int
}

func DefaultProcessorConfig() ProcessorConfig {
	return ProcessorConfig{
		MaxDimension: MaxDimension,
		JPEGQuality:  JPEGQuality,
	}
}

func NewImageProcessor(cfg ProcessorConfig) *ImageProcessor {
	if cfg.MaxDimension <= 0 {
		cfg.MaxDimension = MaxDimension
	}
	if cfg.JPEGQuality <= 0 {
		cfg.JPEGQuality = JPEGQuality
	}
	return &ImageProcessor{
		maxDimension: cfg.MaxDimension,
		jpegQuality:  cfg.JPEGQuality,
	}
}

func (p *ImageProcessor) Process(vf ValidatedFile) (ProcessedFile, error) {
	if !vf.Format.NeedsTranscoding() {
		return ProcessedFile{
			Name:          vf.Name,
			Data:          vf.Data,
			Format:        vf.Format,
			WasTranscoded: false,
		}, nil
	}

	img, _, err := image.Decode(bytes.NewReader(vf.Data))
	if err != nil {
		return ProcessedFile{}, &FileError{
			FileName: vf.Name,
			Detected: string(vf.Format),
			Size:     vf.Size(),
			Err:      fmt.Errorf("%w: no se pudo decodificar la imagen: %v", ErrUnsupportedFormat, err),
		}
	}

	img = p.resizeIfNeeded(img)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: p.jpegQuality}); err != nil {
		return ProcessedFile{}, &FileError{
			FileName: vf.Name,
			Size:     vf.Size(),
			Err:      fmt.Errorf("no se pudo codificar la imagen procesada: %w", err),
		}
	}

	return ProcessedFile{
		Name:          vf.Name,
		Data:          buf.Bytes(),
		Format:        FormatJPEG,
		WasTranscoded: true,
	}, nil
}

// ProcessAll procesa un lote. Igual que el validador, es todo-o-nada: si una
// imagen falla al decodificar, se rechaza el lote completo en vez de subir
// una galería a medias.
func (p *ImageProcessor) ProcessAll(files []ValidatedFile) ([]ProcessedFile, error) {
	out := make([]ProcessedFile, 0, len(files))
	for _, vf := range files {
		pf, err := p.Process(vf)
		if err != nil {
			return nil, err
		}
		out = append(out, pf)
	}
	return out, nil
}

// resizeIfNeeded reduce la imagen si su lado más largo excede maxDimension,
// manteniendo el aspect ratio. Si ya está dentro del límite, la devuelve
// intacta (evita un resize innecesario que igual perdería calidad).
func (p *ImageProcessor) resizeIfNeeded(img image.Image) image.Image {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	longest := w
	if h > longest {
		longest = h
	}
	if longest <= p.maxDimension {
		return img
	}

	scale := float64(p.maxDimension) / float64(longest)
	newW := int(float64(w) * scale)
	newH := int(float64(h) * scale)
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	// CatmullRom da mejor nitidez que ApproxBiLinear para fotos, a costa de
	// más CPU; para un pipeline de subida (no tiempo real) vale la pena.
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)
	return dst
}