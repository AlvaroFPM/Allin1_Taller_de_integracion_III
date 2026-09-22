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

// --- Fixtures ---------------------------------------------------------

func solidImage(w, h int, c color.Color) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, c)
		}
	}
	return img
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("no se pudo generar el JPEG de prueba: %v", err)
	}
	return buf.Bytes()
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("no se pudo generar el PNG de prueba: %v", err)
	}
	return buf.Bytes()
}

func decodeImage(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("no se pudo decodificar el resultado del procesador: %v", err)
	}
	return img
}

func newTestProcessor() *ImageProcessor {
	return NewImageProcessor(DefaultProcessorConfig())
}

// vf construye un ValidatedFile como si ya hubiera pasado por el validador,
// sin necesidad de invocarlo (el procesador confía en el Format que le pasan).
func vf(name string, data []byte, format Format) ValidatedFile {
	return ValidatedFile{File: File{Name: name, Data: data}, Format: format}
}

// --- Resize: sí lo necesita -------------------------------------------

func TestProcessRedimensionaCuandoExcedeElLimite(t *testing.T) {
	p := newTestProcessor()

	// 4000x3000 -> lado más largo excede 1920, debe reducirse a 1920x1440
	// manteniendo el aspect ratio (4000/3000 == 1920/1440).
	src := solidImage(4000, 3000, color.RGBA{R: 200, G: 50, B: 50, A: 255})
	input := vf("producto.jpg", encodeJPEG(t, src), FormatJPEG)

	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("no se esperaba error: %v", err)
	}
	if !out.WasTranscoded {
		t.Error("WasTranscoded debería ser true: la imagen excedía el límite")
	}
	if out.Format != FormatJPEG {
		t.Errorf("Format = %q, se esperaba image/jpeg", out.Format)
	}

	result := decodeImage(t, out.Data)
	b := result.Bounds()
	if b.Dx() != 1920 || b.Dy() != 1440 {
		t.Errorf("dimensiones = %dx%d, se esperaba 1920x1440", b.Dx(), b.Dy())
	}
}

// --- Resize: no lo necesita ---------------------------------------------

func TestProcessNoTocaImagenDentroDelLimite(t *testing.T) {
	p := newTestProcessor()

	// 800x600 está dentro del límite: no debe redimensionarse.
	src := solidImage(800, 600, color.RGBA{R: 10, G: 20, B: 30, A: 255})
	input := vf("chica.jpg", encodeJPEG(t, src), FormatJPEG)

	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("no se esperaba error: %v", err)
	}

	result := decodeImage(t, out.Data)
	b := result.Bounds()
	if b.Dx() != 800 || b.Dy() != 600 {
		t.Errorf("dimensiones = %dx%d, se esperaba 800x600 (sin cambios)", b.Dx(), b.Dy())
	}
}

// Caso borde: exactamente en el límite no debe redimensionarse (la condición
// es "excede", no "alcanza").
func TestProcessLimiteExacto(t *testing.T) {
	p := newTestProcessor()
	src := solidImage(1920, 1080, color.RGBA{A: 255})
	input := vf("justo.jpg", encodeJPEG(t, src), FormatJPEG)

	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("no se esperaba error: %v", err)
	}
	result := decodeImage(t, out.Data)
	b := result.Bounds()
	if b.Dx() != 1920 || b.Dy() != 1080 {
		t.Errorf("dimensiones = %dx%d, se esperaba 1920x1080 sin cambios", b.Dx(), b.Dy())
	}
}

// --- PNG de entrada: se unifica a JPEG ------------------------------------

func TestProcessPNGSeConvierteAJPEG(t *testing.T) {
	p := newTestProcessor()
	src := solidImage(500, 500, color.RGBA{R: 1, G: 2, B: 3, A: 255})
	input := vf("logo.png", encodePNG(t, src), FormatPNG)

	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("no se esperaba error: %v", err)
	}
	if out.Format != FormatJPEG {
		t.Errorf("Format = %q, todo lo transcodificado debe salir como JPEG", out.Format)
	}
	if !out.WasTranscoded {
		t.Error("WasTranscoded debería ser true para un PNG de entrada")
	}
}

// --- AVIF: passthrough ----------------------------------------------------

func TestProcessAVIFPassthrough(t *testing.T) {
	p := newTestProcessor()
	original := avifHeader() // definido en validator_test.go
	input := vf("hero.avif", original, FormatAVIF)

	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("AVIF en passthrough no debería fallar: %v", err)
	}
	if out.WasTranscoded {
		t.Error("WasTranscoded debería ser false: AVIF va sin tocar")
	}
	if out.Format != FormatAVIF {
		t.Errorf("Format = %q, se esperaba image/avif", out.Format)
	}
	if !bytes.Equal(out.Data, original) {
		t.Error("el passthrough de AVIF no debe alterar ni un byte del original")
	}
}

// --- Errores de decodificación --------------------------------------------

// Cubre el caso límite que ya habíamos identificado con el validador: un
// archivo con firma JPEG válida pero cuerpo corrupto pasa la validación por
// magic bytes, y es responsabilidad del procesador rechazarlo al decodificar.
func TestProcessRechazaJPEGCorrupto(t *testing.T) {
	p := newTestProcessor()
	fake := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{0x41}, 64)...)
	input := vf("corrupto.jpg", fake, FormatJPEG)

	_, err := p.Process(input)
	if !errors.Is(err, ErrUnsupportedFormat) {
		t.Fatalf("error = %v, se esperaba ErrUnsupportedFormat", err)
	}

	var fe *FileError
	if !errors.As(err, &fe) {
		t.Fatalf("el error debería ser *FileError, es %T", err)
	}
	if fe.FileName != "corrupto.jpg" {
		t.Errorf("FileError.FileName = %q, se esperaba corrupto.jpg", fe.FileName)
	}
}

// --- Lotes -----------------------------------------------------------------

func TestProcessAllTodoOnada(t *testing.T) {
	p := newTestProcessor()
	good := vf("ok.jpg", encodeJPEG(t, solidImage(100, 100, color.RGBA{A: 255})), FormatJPEG)
	bad := vf("mal.jpg", []byte{0xFF, 0xD8, 0xFF, 0x00, 0x00}, FormatJPEG)

	out, err := p.ProcessAll([]ValidatedFile{good, bad, good})
	if err == nil {
		t.Fatal("se esperaba error: el lote incluye un archivo corrupto")
	}
	if out != nil {
		t.Error("ante un fallo no debe devolverse ningún archivo procesado")
	}
}

// --- Limitación conocida: PNG con transparencia pierde el canal alfa -----

// El procesador unifica toda imagen transcodificada a JPEG, que no soporta
// canal alfa. Un PNG con transparencia real (no solo RGB opaco encapsulado en
// PNG) pierde esa transparencia al pasar por este pipeline: el fondo
// transparente se compone sobre negro/blanco según el encoder.
//
// Aceptado como limitación conocida para el sprint actual: el flujo de
// "Publicación" (fotos de productos/servicios) no incluye subida de logos con
// transparencia. Si en el futuro se agrega esa funcionalidad (ej. logo de
// tienda/marca del vendedor), este test empezará a fallar como recordatorio
// de que PNG-con-alpha necesita una ruta de procesamiento separada que
// preserve el canal alfa (por ejemplo, re-encodeando a PNG en vez de JPEG
// para esos casos).
func TestLimitacionConocida_PNGConTransparenciaPierdeElAlfa(t *testing.T) {
	p := newTestProcessor()

	// Imagen con transparencia real: mitad opaca, mitad totalmente transparente.
	src := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for x := 0; x < 100; x++ {
		for y := 0; y < 100; y++ {
			if x < 50 {
				src.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255}) // opaco
			} else {
				src.Set(x, y, color.RGBA{R: 0, G: 0, B: 0, A: 0}) // transparente
			}
		}
	}

	input := vf("logo-transparente.png", encodePNG(t, src), FormatPNG)
	out, err := p.Process(input)
	if err != nil {
		t.Fatalf("no se esperaba error: %v", err)
	}

	result := decodeImage(t, out.Data)

	// JPEG no tiene modelo de color con alfa: un decode de JPEG estándar de la
	// stdlib siempre reporta A=0xffff (opaco) sin importar el pixel original.

	r, g, b, a := result.At(75, 75).RGBA()
	if a != 0xffff {
		t.Fatalf("un JPEG decodificado siempre reporta alfa opaco (0xffff), se obtuvo %d — el test asume mal el color model", a)
	}

	// La zona que era transparente ahora tiene un color sólido (compuesto
	// sobre blanco por el encoder JPEG de la stdlib), no transparencia real.
	// Documentamos el valor observado, no lo prescribimos: lo que importa es
	// que YA NO es transparente.
	t.Logf("LIMITACIÓN CONOCIDA: píxel que era transparente ahora es RGB(%d,%d,%d) opaco — "+
		"el canal alfa se perdió al convertir PNG->JPEG", r>>8, g>>8, b>>8)
}