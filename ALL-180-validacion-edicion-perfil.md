# ALL-180 — Validación de edición de perfil

- Tarea: https://linear.app/allin1/issue/ALL-180/sprint-final-s2-iam-validar-edicion-de-perfil-y-manejo-de-entradas
- Fecha: 2026-11-17.
- Rama: `qa/ALL-180-iam-validar-edicion-perfil`.
- Base: `9f81985`, con ALL-139 integrado.
- Alcance: perfil propio de IAM, validación, persistencia y respuesta del formulario existente.

## Entorno y método

PostgreSQL **16.11 real**, temporal y aislado, en `127.0.0.1:5433`, base `iam_db`. Docker Desktop no respondió desde el entorno de ejecución, por lo que se usaron binarios PostgreSQL temporales, sin modificar dependencias ni configuración del proyecto. IAM se ejecutó desde esta rama en HTTP `18081` y gRPC `15057`. Next.js se ejecutó en `http://localhost:3001`, con `NEXT_PUBLIC_API_URL=http://localhost:18081`.

Los tests usan transacciones con rollback. Para comprobar rechazos se consultan las filas completas de `perfiles` y `usuarios` antes y después, incluyendo sus fechas. Se ejecuta cada rechazo tanto con perfil existente como sin perfil complementario. Las peticiones contienen además cambios válidos en otros campos, para detectar escrituras parciales. No se registran credenciales, JWT ni datos de cuentas en este documento.

`TEST/BD` identifica una ejecución Go contra PostgreSQL, `UI/HTTP` una ejecución en Chrome automatizada con Playwright y backend real, y `HTTP` una petición directa al Gateway real. Las imágenes se validan como URL; no se prueba la subida ni la existencia del recurso en Cloudinary.

## Defecto reproducido y corrección

La expresión regular permitía `+` seguido de 20 dígitos: **21 caracteres totales**, pese a que el mensaje y la columna `telefono varchar(20)` establecen un máximo de 20.

Antes de corregir:

- `TestProfilePhoneTotalLength/21_con_prefijo` falló: esperaba `InvalidArgument`, obtuvo `OK`.
- `TestProfileRejectedUpdatePreservesDatabase/con_perfil/telefono_21_con_mas` falló contra PostgreSQL: esperaba `InvalidArgument` (3), obtuvo `Internal` (13).
- PostgreSQL devolvió `value too long for type character varying(20) (SQLSTATE 22001)`.

Se añadió `len(tel) > 20` a la validación existente, después de recortar espacios. El alfabeto admitido por la expresión regular es ASCII, por lo que el conteo de bytes coincide con el de caracteres válidos. Se mantienen el mensaje existente y las demás reglas. Ahora el caso se rechaza antes de escribir y el Gateway devuelve HTTP 400, código gRPC 3. No hubo cambios de esquema, contratos, dependencias ni frontend.

## Matriz de persistencia

Todos los casos siguientes se ejecutaron con PostgreSQL real. Los nombres corresponden al archivo `backend-go/internal/service/profile_validation_integration_test.go`.

| Caso | BD antes | Resultado | BD después | Evidencia |
| --- | --- | --- | --- | --- |
| Actualización válida, perfil existente | Un perfil con valores previos | OK | Textos recibidos y ambas imágenes persistidos; un solo perfil | `TEST/BD TestProfileAcceptedUpdateDatabase/actualiza_perfil_existente` |
| Primera actualización válida | Sin perfil complementario | OK | Se crea un único perfil; valores recibidos persistidos | `TEST/BD TestProfileAcceptedUpdateDatabase/crea_perfil_ausente` |
| Teléfono de 20 caracteres con `+`, ciudad y región de 100 caracteres Unicode, imágenes de 500 caracteres | Con y sin perfil | OK | Todos los límites persistidos correctamente | Los dos casos de `TestProfileAcceptedUpdateDatabase` |
| Textos e imágenes vacíos | Perfil con textos e imágenes | OK | Bio, teléfono, habilidades, ciudad y región vacíos; foto y portada conservadas; mismo ID de perfil | Segunda actualización en los dos casos anteriores |
| Bio y habilidades con espacios exteriores | Con y sin perfil | OK | Valores recortados | Los dos casos anteriores |
| Teléfono con letras | Un perfil / ningún perfil | InvalidArgument | Fila completa idéntica / sigue sin perfil | `TEST/BD .../telefono_letras` |
| Teléfono de 6 caracteres | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../telefono_corto` |
| Teléfono de 21 caracteres sin `+` | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../telefono_21` |
| Teléfono de 21 caracteres con `+` | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../telefono_21_con_mas` |
| Ciudad de 101 caracteres Unicode | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../ciudad_101_unicode` |
| Región de 101 caracteres Unicode | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../region_101_unicode` |
| Foto de dominio externo | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../foto_externa` |
| Portada de dominio externo | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../portada_externa` |
| Foto de otro cloud | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../foto_otro_cloud` |
| Foto con HTTP en vez de HTTPS | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../foto_HTTP` |
| Foto de 501 caracteres | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../foto_501` |
| Portada de 501 caracteres | Un perfil / ningún perfil | InvalidArgument | Sin cambios ni creación | `TEST/BD .../portada_501` |

Los 12 rechazos son subcasos de `TestProfileRejectedUpdatePreservesDatabase`, bajo `con_perfil` y `sin_perfil`: **24 comprobaciones de rechazo**. La comparación de `usuarios` también confirma que la edición no altera la cuenta.

## Verificación de interfaz y Gateway

Se creó una cuenta temporal en IAM y se abrió `/perfil` con su sesión, sin simular las respuestas HTTP. Se usó Chrome con un contexto de navegador aislado.

| Pasos ejecutados | Resultado observado |
| --- | --- |
| Abrir perfil sin complemento y enviar teléfono de 21 caracteres con `+` junto a una ciudad distinta | HTTP 400, gRPC 3; mensaje de teléfono visible; modal abierto y borrador conservado; ningún aviso de éxito; GET mantiene los valores previos |
| Corregir teléfono a 20 caracteres, guardar ciudad con espacios exteriores y recargar | HTTP 200; aviso de éxito; al reabrir el formulario aparecen teléfono persistido y ciudad recortada |
| Cambiar ciudad a 101 caracteres Unicode y guardar | HTTP 400; mensaje `la ciudad no puede superar los 100 caracteres`; sin aviso de éxito; GET completo idéntico al anterior |
| Corregir ciudad, cambiar región a 101 caracteres Unicode y guardar | HTTP 400; mensaje `la región no puede superar los 100 caracteres`; sin aviso de éxito; GET completo idéntico al anterior |
| Vaciar teléfono, ciudad, región y biografía; guardar y recargar | HTTP 200; aviso de éxito; los cuatro campos siguen vacíos al reabrir |
| PUT directo con foto externa, portada externa o teléfono con letras, más un cambio válido de ciudad | Cada petición devuelve HTTP 400 y gRPC 3; GET completo sin cambios |

Los rechazos de imágenes se probaron por HTTP y por tests de persistencia: el modal de datos personales no edita esas URLs. No se atribuye esa cobertura a la interfaz.

## Comandos reproducibles

En una terminal PowerShell ubicada en la raíz del repositorio, con PostgreSQL de pruebas disponible en `localhost:5433`, usuario `postgres`, base `iam_db` y `POSTGRES_PASSWORD_IAM` configurada localmente. No ejecutar contra una base de producción: el helper hace `AutoMigrate` antes de abrir las transacciones de cada caso.

```powershell
Push-Location backend-go
go test ./internal/service -run '^(TestAuthService|TestGetProfileByUserID|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUpdateProfile|TestProfile)' -count=1 -v
go build ./...
gofmt -l internal/service/profile_validation_integration_test.go
Pop-Location

Push-Location frontend-marketplace
node --test src/services/authService.test.mjs
Pop-Location
git diff --check
```

Para repetir la comprobación visual, levantar IAM contra esa BD y el frontend apuntando a IAM, usar una cuenta local de prueba y seguir la tabla anterior desde `/perfil`. Verificar en Network el PUT a `/v1/auth/profile`, el código y cuerpo de respuesta, y volver a cargar la página después de guardar. No compartir cookies, tokens ni contraseñas en el PR.

## Resultado y revisión

- Pruebas frontend del servicio de perfil: **3 PASS, 0 FAIL, 0 SKIP**.
- Matriz de persistencia y pruebas IAM: **11 grupos principales PASS, 0 FAIL, 0 SKIP**, incluyendo los 24 rechazos con comparación de BD, los dos escenarios válidos y los tres límites de teléfono. Salida final: `ok .../backend-go/internal/service 13.834s`, exit code 0.
- Compilación `go build ./...`: **exit code 0**.
- `gofmt -l` del archivo nuevo y `git diff --check`: sin salida, exit code 0.
- No se ejecutó la suite funcional de Catalog, Chat u Orders; no se modificaron esos servicios.
- El panel de publicaciones registró un error de red porque Catalog no estaba levantado. La carga y edición del perfil IAM sí se verificaron; ese panel queda fuera de este alcance.
- Pendiente de proceso: revisión humana del diff y revisión cruzada antes del cierre. No se atribuye una revisión a un compañero que todavía no la realizó.
- Entregable local sin commit ni push, preparado para revisión del usuario.
