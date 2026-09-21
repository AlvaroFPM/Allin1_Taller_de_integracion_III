package media

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func newImage() image.Image {
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	for x := 0; x < 32; x++ {
		for y := 0; y < 32; y++ {
			img.Set(x, y, color.RGBA{R: uint8(x * 8), G: uint8(y * 8), B: 120, A: 255})
		}
	}
	return img
}

func jpegBytes(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, newImage(), nil); err != nil {
		t.Fatalf("no se pudo generar el JPEG de prueba: %v", err)
	}
	return buf.Bytes()
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, newImage()); err != nil {
		t.Fatalf("no se pudo generar el PNG de prueba: %v", err)
	}
	return buf.Bytes()
}

// RIFF....WEBPVP8  + relleno
func webpHeader() []byte {
	b := []byte("RIFF\x24\x00\x00\x00WEBPVP8 ")
	return append(b, make([]byte, 24)...)
}

// Caja ftyp de ISOBMFF con brand "avif"
func avifHeader() []byte {
	return []byte{
		0x00, 0x00, 0x00, 0x20, 'f', 't', 'y', 'p',
		'a', 'v', 'i', 'f', 0x00, 0x00, 0x00, 0x00,
		'a', 'v', 'i', 'f', 'm', 'i', 'f', '1',
		'm', 'i', 'a', 'f', 'M', 'A', '1', 'B',
	}
}

func newTestValidator() *FileValidator {
	return NewFileValidator(DefaultValidatorConfig())
}

// --- Casos válidos --------------------------------------------------------

func TestValidateAceptaFormatosSoportados(t *testing.T) {
	v := newTestValidator()

	cases := []struct {
		name       string
		file       File
		wantFormat Format
	}{
		{"jpeg", File{Name: "foto.jpg", Data: jpegBytes(t)}, FormatJPEG},
		{"png", File{Name: "logo.png", Data: pngBytes(t)}, FormatPNG},
		{"webp", File{Name: "banner.webp", Data: webpHeader()}, FormatWEBP},
		{"avif", File{Name: "hero.avif", Data: avifHeader()}, FormatAVIF},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := v.Validate(tc.file)
			if err != nil {
				t.Fatalf("se esperaba archivo válido, se obtuvo error: %v", err)
			}
			if got.Format != tc.wantFormat {
				t.Errorf("formato = %q, se esperaba %q", got.Format, tc.wantFormat)
			}
			if got.Size() != tc.file.Size() {
				t.Errorf("el validador alteró el contenido: %d != %d", got.Size(), tc.file.Size())
			}
		})
	}
}

// El AVIF debe marcarse como passthrough y todo lo demás como transcodificable.
func TestNeedsTranscoding(t *testing.T) {
	if FormatAVIF.NeedsTranscoding() {
		t.Error("AVIF no debería transcodificarse: va directo a Cloudinary")
	}
	for _, f := range []Format{FormatJPEG, FormatPNG, FormatWEBP} {
		if !f.NeedsTranscoding() {
			t.Errorf("%s debería pasar por el procesador", f)
		}
	}
}

// --- Casos rechazados -----------------------------------------------------

func TestValidateRechazaContenidoInvalido(t *testing.T) {
	v := newTestValidator()

	cases := []struct {
		name    string
		file    File
		wantErr error
	}{
		{"vacío", File{Name: "vacio.png", Data: nil}, ErrEmptyFile},
		{"texto plano disfrazado", File{Name: "imagen.png", Data: []byte("esto no es una imagen, es texto")}, ErrUnsupportedFormat},
		{"pdf", File{Name: "doc.jpg", Data: []byte("%PDF-1.4\n%âãÏÓ\n1 0 obj")}, ErrUnsupportedFormat},
		{"gif no permitido", File{Name: "anim.gif", Data: append([]byte("GIF89a"), make([]byte, 32)...)}, ErrUnsupportedFormat},
		{"svg (vector XSS)", File{Name: "icono.svg", Data: []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`)}, ErrUnsupportedFormat},
		{"un solo byte", File{Name: "x.jpg", Data: []byte{0xFF}}, ErrUnsupportedFormat},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := v.Validate(tc.file)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error = %v, se esperaba %v", err, tc.wantErr)
			}

			var fe *FileError
			if !errors.As(err, &fe) {
				t.Fatalf("el error debería ser *FileError para identificar el archivo, es %T", err)
			}
			if fe.FileName != tc.file.Name {
				t.Errorf("FileError.FileName = %q, se esperaba %q", fe.FileName, tc.file.Name)
			}
		})
	}
}

func TestValidateLimiteDePeso(t *testing.T) {
	data := jpegBytes(t)
	exact := int64(len(data))

	t.Run("en el límite exacto pasa", func(t *testing.T) {
		v := NewFileValidator(ValidatorConfig{MaxFileSize: exact})
		if _, err := v.Validate(File{Name: "f.jpg", Data: data}); err != nil {
			t.Fatalf("un archivo de exactamente MaxFileSize debe aceptarse: %v", err)
		}
	})

	t.Run("un byte por encima falla", func(t *testing.T) {
		v := NewFileValidator(ValidatorConfig{MaxFileSize: exact - 1})
		_, err := v.Validate(File{Name: "f.jpg", Data: data})
		if !errors.Is(err, ErrFileTooLarge) {
			t.Fatalf("error = %v, se esperaba ErrFileTooLarge", err)
		}
	})

	t.Run("el default son 5MB", func(t *testing.T) {
		if got := newTestValidator().MaxFileSize(); got != 5*1024*1024 {
			t.Errorf("MaxFileSize = %d, se esperaban 5MB", got)
		}
	})
}

// --- La extensión no decide nada -----------------------------------------

func TestValidateIgnoraLaExtensionDeclarada(t *testing.T) {
	v := newTestValidator()

	// Un PNG renombrado a .jpg sigue siendo una imagen válida: se acepta,
	// pero el formato real detectado debe ser PNG, no JPEG.
	got, err := v.Validate(File{Name: "mentira.jpg", Data: pngBytes(t)})
	if err != nil {
		t.Fatalf("un PNG con extensión .jpg debe aceptarse: %v", err)
	}
	if got.Format != FormatPNG {
		t.Errorf("formato = %q, se esperaba image/png (magic bytes, no extensión)", got.Format)
	}
	if !got.ExtensionMismatch() {
		t.Error("ExtensionMismatch() debería ser true para un PNG llamado .jpg")
	}

	ok, err := v.Validate(File{Name: "correcta.JPEG", Data: jpegBytes(t)})
	if err != nil {
		t.Fatalf("JPEG válido rechazado: %v", err)
	}
	if ok.ExtensionMismatch() {
		t.Error("ExtensionMismatch() debería ser false para .JPEG en mayúsculas")
	}
}

// --- Lotes ----------------------------------------------------------------

func TestValidateAll(t *testing.T) {
	v := newTestValidator()
	jpg := File{Name: "a.jpg", Data: jpegBytes(t)}
	bad := File{Name: "b.png", Data: []byte("no soy una imagen")}

	t.Run("lote válido", func(t *testing.T) {
		out, err := v.ValidateAll([]File{jpg, {Name: "c.png", Data: pngBytes(t)}})
		if err != nil {
			t.Fatalf("lote válido rechazado: %v", err)
		}
		if len(out) != 2 {
			t.Fatalf("len(out) = %d, se esperaban 2", len(out))
		}
	})

	t.Run("sin archivos", func(t *testing.T) {
		if _, err := v.ValidateAll(nil); !errors.Is(err, ErrNoFiles) {
			t.Fatalf("error = %v, se esperaba ErrNoFiles", err)
		}
	})

	t.Run("todo o nada", func(t *testing.T) {
		out, err := v.ValidateAll([]File{jpg, bad, jpg})
		if !errors.Is(err, ErrUnsupportedFormat) {
			t.Fatalf("error = %v, se esperaba ErrUnsupportedFormat", err)
		}
		if out != nil {
			t.Error("ante un fallo no debe devolverse ningún archivo parcial")
		}
	})

	t.Run("demasiados archivos", func(t *testing.T) {
		v := NewFileValidator(ValidatorConfig{MaxFiles: 2})
		if _, err := v.ValidateAll([]File{jpg, jpg, jpg}); !errors.Is(err, ErrTooManyFiles) {
			t.Fatalf("error = %v, se esperaba ErrTooManyFiles", err)
		}
	})
}

func TestLimitacionConocida_JPEGCorruptoPasaElValidador(t *testing.T) {
	v := newTestValidator()
	fake := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{0x41}, 64)...)

	if _, err := v.Validate(File{Name: "corrupto.jpg", Data: fake}); err != nil {
		t.Fatalf("limitación esperada: el validador no detecta JPEG corrupto, pero devolvió %v", err)
	}
}
