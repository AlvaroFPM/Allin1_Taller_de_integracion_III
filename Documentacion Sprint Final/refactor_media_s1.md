# Refactor Media S1 — evidencia de equivalencia

## Alcance y base

Rama: `refactor/media-s1-simplificar-comportamiento`. Identificador de la nueva tarea Linear pendiente de indicar; **no reutilizar ALL-133**, que corresponde al análisis anterior.

Inicio: `develop` local en `edd6010`, sin cambios locales. La revisión inicial comparó las rutas de Media con `b3dc9ad`: sin diferencias en ellas. Se conserva el resto de cambios posteriores del equipo. No se hizo pull adicional.

## Simplificaciones y consumidores revisados

- [media_service.go](../backend-go/internal/service/media/media_service.go): reemplaza dos mapas con claves duplicadas por una única política interna de carpeta/dimensión. Las únicas consultas estaban en Upload. Se conservan PERFIL → media/perfil, 512; PORTADA → media/portada, 1600. Orden: comprobar repositorio, tipo, subir, comprobar cardinalidad, persistir y devolver.
- [media_handler.go](../backend-go/internal/api/media/media_handler.go): elimina paréntesis redundantes del límite y aclara el nombre del registro. Conserva normalización de tipo, autenticación vía contexto, campos, límites, JSON y códigos.
- [upload_handler.go](../backend-go/internal/api/media/upload_handler.go) y [response.go](../backend-go/internal/api/media/response.go): mueve mapUploadError, writeError y writeJSON existentes al archivo compartido. Ambos handlers las consumen. Se comprobó igualdad textual de los cuerpos con HEAD previo; no son funciones nuevas.
- [errors.go](../backend-go/internal/service/media/errors.go): corrige documentación de 415 para formato inválido envuelto en FileError. No cambia errores.
- [main.go](../backend-go/cmd/media/main.go): agrupación de imports, indentación y salto final. No modifica rutas, middleware, dependencias, migración ni arranque.
- Se mantienen ProcessedFile.Format y WasTranscoded: tienen consumidores en processor_test.go. No se tocan validación, procesamiento, modelos públicos, archivos pb, contratos ni dependencias.
- [media_handler_test.go](../backend-go/internal/api/media/media_handler_test.go): pruebas y dobles nuevos expresamente solicitados. La restricción de no añadir funciones/métodos se respeta en código de aplicación; los nuevos símbolos son exclusivos de tests.

## Comprobación antes/después

Primero se ejecutó la suite existente sobre aplicación original: API OK (2.867 s), servicio OK (4.013 s).
Después se añadieron pruebas de caracterización **antes del refactor** y se ejecutaron sobre código original. La primera ejecución detectó una expectativa incompleta del test: MIME real de texto incluye charset=utf-8. Se corrigió la expectativa, no la aplicación, y se repitió con éxito antes de editar producción.

Comando de comparación desde backend-go:

```powershell
go test -count=1 -v ./internal/api/media -run 'TestMediaHandle_ContratoYPersistencia|TestHandle_SubidaExitosa|TestHandle_FormatoInvalido'
```

Resultado: PASS antes (3.733 s) y después (3.584 s). Los tiempos no son benchmarks.

| Caso observado | Antes | Después |
|---|---|---|
| Perfil normalizado desde " perfil " | 201; media/perfil; 512×256 | Igual |
| Portada normalizada desde " portada " | 201; media/portada; 1600×800 | Igual |
| JSON nominal exacto | id=42, tipo normalizado, url=https://example.test/image.jpg, publicId=media/test | Igual |
| Registro enviado al repositorio | usuario=7, tipo, URL y PublicID; upload antes de persist | Igual |
| Uso posterior del servicio compartido en lote | 200; media_uploads; 1920×960 | Igual |
| Formato inválido | 415; mensaje exacto con MIME y tamaño; cero efectos | Igual |
| Sin usuario / método incorrecto | 401 / 405; cero efectos | Igual |
| Tipo inválido / repositorio nulo | 400 / 503 | Igual |
| Repositorio nulo y tipo inválido juntos | 503 primero | Igual |
| Cero o dos archivos en file | 400; cero efectos | Igual |
| Fallo de proveedor | 500; intento de upload, sin persist | Igual |
| Fallo de persistencia | 500; upload y luego intento de persist; detalle interno de BD no expuesto | Igual |
| Lote válido / formato inválido (tests existentes) | 200 / 415 | Igual |

Las imágenes de prueba son JPEG 2000×1000; las dimensiones se obtienen decodificando los bytes entregados al uploader, no consultando la política interna.

## Verificaciones finales ejecutadas

Desde backend-go:

```powershell
go test -count=1 ./internal/api/media ./internal/service/media ./internal/middleware
go build ./internal/api/media ./internal/service/media ./cmd/media
go vet ./internal/api/media ./internal/service/media ./cmd/media
```

- API OK (5.212 s), servicio OK (4.673 s), middleware OK (0.395 s).
- Build y vet terminaron con código 0.
- git diff --check sin errores; formato gofmt revisado.
- Comparación textual de funciones trasladadas: idénticas.
- No hay funciones ni métodos productivos nuevos; las tres funciones compartidas solo cambian de archivo.

## Limitaciones y trabajo posterior

Las pruebas nuevas inyectan usuario en contexto: ejercitan el handler y servicio completos con bytes multipart, pero no una sesión real ni un servidor desplegado. La suite existente de middleware también se ejecutó. No se prueba aquí JWT + upload como recorrido HTTP desplegado.

Uploader y repositorio son dobles sin red ni BD: se comprueba payload/orden de Create, no SQL real, índices ni transacciones. No se ejecutaron integración Cloudinary, despliegue, suite global ni carga.

Pendientes enlazados al [informe ALL-133, fuente](./analisis%20tecnico%20media/informe_revision_media_s1.tex) y [PDF](./analisis%20tecnico%20media/informe_revision_media_s1.pdf):
P1/P2 huérfanos/subidas parciales; P3 recursos; P4 validación AVIF; P5 transparencia; P7 gateway y P8 margen multipart permanecen fuera del refactor. P6 mejora con la nueva cobertura, pero la integración real sigue pendiente. No se crean ni se declaran cerrados tickets externos.

## Entrega

El cambio está preparado para PR hacia develop. Asociar la nueva clave Linear cuando se proporcione y enlazar PR/commit tras publicación. No confundir estos resultados con resolución de defectos funcionales. No se publica ni fusiona automáticamente.
