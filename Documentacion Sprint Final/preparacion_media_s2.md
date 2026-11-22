# ALL-145: ejecucion local con almacenamiento y BD persistente

Base: `origin/develop` en `9edaad8`. Rama: `ALL-145-media-persistencia-local`.
Entorno: Docker Compose local. Kubernetes queda fuera de esta entrega.
Implementacion local: commit `5e93bdeff6ed49741b5066fe6146922d0e998f5b`.
Dependencia ALL-134 incluida en la base. No se necesita otra implementacion de subida: se reutiliza POST /v1/media/upload.

## Cambios

- [Plantilla de entorno](../.env.example): JWT unico, puerto local de IAM 8081 y variables de Media agrupadas.
- [Compose](../docker-compose.yml): validacion de variables obligatorias de Media, puertos Media/BD publicados solo en loopback, espacio temporal de 64 MiB para multipart y hasta cinco reintentos de arranque ante salida con error. Volumen `media_db_data` conservado.
- Se retiran healthchecks de IAM/Catalog basados en wget, incompatible con scratch. No se sustituyen por una comprobacion funcional: `running` no significa servicio saludable.
- [Dockerfile compartido](../backend-go/Dockerfile): SERVICE_PATH se declara al compilar para no invalidar las capas de dependencias por microservicio. No cambia el ejecutable seleccionado.
- [Arranque de Media](../backend-go/cmd/media/main.go): rechaza variables esenciales vacias y BD inaccesible; no inicia sin repositorio. `/healthz` comprueba PostgreSQL con timeout de dos segundos. Timeout de cabeceras de cinco segundos e inactividad HTTP de sesenta segundos. No se establece timeout global de subida.
- [Regresion del arranque](../backend-go/cmd/media/main_test.go): ejecuta el proceso con configuracion sintetica, sin cargar credenciales locales, para verificar rechazo de JWT ausente y BD inaccesible.

Estos son cambios funcionales de operacion S2, no un refactor de equivalencia S1.
Compose interpola el proyecto completo: sus variables requeridas deben estar configuradas incluso al seleccionar otros servicios.

## Evidencia ejecutada el 16 de noviembre de 2026

- Pruebas de cmd/media, API Media, servicio Media y middleware: PASS.
- `go vet` de cmd/media, API y servicio: sin errores.
- Construccion Docker de Media: correcta. Hubo fallos intermitentes de red (EOF), seguidos de reintentos.
- Contenedor de prueba con JWT vacio: salida no cero y rechazo explicito.
- Contenedor de prueba con DB_HOST=127.0.0.1 y DB_PORT=1: salida no cero; no inicia sin persistencia.
- Media real: `/healthz` 200 con PostgreSQL; 503 al detener exclusivamente postgres_media; 200 tras restaurarlo, sin reiniciar Media.
- Seis referencias existentes antes y despues de las comprobaciones. Es un conteo, no una comparacion de todos sus campos ni evidencia de una nueva subida.
- Solicitud sin sesion a `/v1/media/upload`: 401 en la preparacion previa.
- Volumen persistente reutilizado; no se borraron filas ni volumenes.
- Construccion final de IAM y Media con Dockerfile actualizado: correcta. Media reutilizo las capas de descarga de dependencias.
- Registro real en IAM con usuario sintetico, correo bajo example.invalid y password aleatoria mantenida solo en memoria. El token emitido por IAM autorizo una subida real de PNG sintetico 32x32, campo file, tipo PERFIL: HTTP 201. La URL de Cloudinary respondio HEAD 200.
- Nueva referencia de prueba id_media=9: URL HTTPS, public_id no vacio, tipo PERFIL y usuario perteneciente a la cuenta sintetica de IAM. Comparacion de `row_to_json` de la fila completa antes/despues del reinicio de PostgreSQL y Media: identica. Conteo final: siete referencias. `/healthz` final: 200.
- El script inicial se interrumpio despues de subir, por un aviso de Compose interpretado como error por PowerShell. Se retomo la consulta con docker exec, sin repetir la subida. No se afirma que ese primer script completo pasara.
- Quedan una cuenta sintetica local, una referencia y un asset Cloudinary de prueba. No se eliminaron para conservar la evidencia; no se guardaron sus credenciales en el repositorio.

## Reproduccion

Desde backend-go:

```powershell
go test -count=1 ./cmd/media ./internal/api/media ./internal/service/media ./internal/middleware
go vet ./cmd/media ./internal/api/media ./internal/service/media
```

Desde la raiz, con credenciales reales solo en el entorno local:

```powershell
docker compose config --quiet
docker compose build media iam
docker compose up -d media iam
curl.exe -i http://localhost:8083/healthz
docker compose exec -T postgres_media psql -U postgres -d media_db -c "SELECT count(*) FROM media;"
```

No ejecutar `down -v`: elimina los volumenes. Para comprobar indisponibilidad de BD, detener solo postgres_media, consultar healthz, restaurar la BD y esperar su estado healthy. Es una prueba disruptiva local: coordinar antes de repetirla.

## Limites y entrega

- Integracion nominal y persistencia local comprobadas. Publicacion de commit/PR pendiente de autorizacion; no se acredita el despliegue Kubernetes.
- ALL-146 debe completar la matriz de rechazos por tipo, formato, peso y sesion, con comprobacion de ausencia de nuevas referencias.
- La prueba nominal no demuestra todos los flujos ni la recuperacion ante fallos de Cloudinary.
- La variable POSTGRES_PASSWORD_ORDERS no esta configurada en el entorno local: Compose avisa al interpolar el perfil opcional. No se inventaron credenciales ni se habilito Orders.
- No se certifican cuotas, despliegue ni reinicios de Kubernetes.

No se afirma que se corrigieron todas las debilidades del sistema. El cierre debe reflejar el alcance local acordado y enlazar la evidencia publicada. No publicar credenciales, tokens ni datos personales en el PR. Push pendiente de autorizacion del usuario.

## Verificacion final de ALL-145

Se volvio a consultar el entorno, sin crear otra cuenta ni subir otra imagen:

- IAM y Media en ejecucion; ambas bases saludables.
- GET /healthz: 200, cuerpo `ok`.
- Referencia 9: PERFIL, URL HTTPS y public_id presente.
- Volumen montado: `allin1_taller_de_integracion_iii_media_db_data`, en /var/lib/postgresql/data.
- Media ejecuta la imagen local `sha256:77459b035c28c7bf33d2e74e534ec41de4346ef45835b971b9a8eea644285160`, con politica on-failure y cinco reintentos maximos. Es evidencia de la imagen local, no una imagen publicada en un registro.
- Nueva ejecucion sin cache de tests: cmd/media 0.393 s; API Media 1.839 s; servicio Media 2.455 s; middleware 0.143 s. Todos PASS. Vet sin errores.

## Procedimiento de subida para repetir manualmente

Requisitos: entorno local configurado, servicios Media/IAM y sus BD activos, una cuenta de prueba propia en IAM y una imagen sintetica JPEG/PNG menor de 5 MiB. Nunca usar fotos personales para esta comprobacion. Cada ejecucion exitosa crea un asset en Cloudinary y una referencia real; no ejecutar en produccion ni limpiar datos anteriores indiscriminadamente.

En PowerShell desde la raiz, obtener una sesion sin poner la password en el historial:

```powershell
$cred = Get-Credential -Message 'Cuenta de prueba local IAM: correo y password'
$loginBody = @{ email = $cred.UserName; password = $cred.GetNetworkCredential().Password } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri http://localhost:8081/v1/auth/login -ContentType application/json -Body $loginBody
$token = $session.token
if (-not $token) { $token = $session.data.token }
if (-not $token) { throw 'IAM no devolvio una sesion valida' }
$loginBody = $null
$cred = $null
```

Enviar multipart sin fijar manualmente su boundary; no imprimir token ni respuesta de login:

```powershell
Add-Type -AssemblyName System.Net.Http
$imagePath = Read-Host 'Ruta absoluta de una imagen sintetica de prueba'
$http = [System.Net.Http.HttpClient]::new()
$http.Timeout = [TimeSpan]::FromSeconds(60)
$form = [System.Net.Http.MultipartFormDataContent]::new()
$form.Add([System.Net.Http.StringContent]::new('PERFIL'), 'tipo')
$part = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($imagePath))
$form.Add($part, 'file', [System.IO.Path]::GetFileName($imagePath))
$request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, 'http://localhost:8083/v1/media/upload')
$request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
$request.Content = $form
try {
    $response = $http.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 201) { throw ('Subida fallo HTTP ' + [int]$response.StatusCode) }
    $uploaded = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    $mediaId = [int]$uploaded.id
    if ($mediaId -le 0 -or -not $uploaded.publicId -or $uploaded.url -notlike 'https://*') { throw 'Respuesta incompleta' }
    $head = Invoke-WebRequest -Method Head -Uri $uploaded.url -UseBasicParsing
    if ($head.StatusCode -ne 200) { throw 'URL no accesible' }
    "Subida 201, URL 200, referencia $mediaId"
} finally {
    if ($response) { $response.Dispose() }
    $request.Dispose()
    $http.Dispose()
    $token = $null
    $session = $null
}
```

Comprobar persistencia completa, no solamente el conteo. Se usa docker exec porque en Windows PowerShell los avisos de Compose pueden interrumpir un script con ErrorActionPreference=Stop. Los nombres siguientes son los container_name definidos en Compose.

```powershell
$before = docker exec postgres_media psql -U postgres -d media_db -Atc "SELECT row_to_json(m) FROM media m WHERE id_media=$mediaId;"
if ($LASTEXITCODE -ne 0 -or -not $before) { throw 'Referencia no encontrada' }
$stored = $before | ConvertFrom-Json
if ($stored.url -ne $uploaded.url -or $stored.public_id -ne $uploaded.publicId -or $stored.tipo -ne $uploaded.tipo) { throw 'Respuesta y BD difieren' }
docker restart postgres_media
if ($LASTEXITCODE -ne 0) { throw 'No se pudo reiniciar BD' }
docker compose up -d --wait postgres_media
if ($LASTEXITCODE -ne 0) { throw 'BD no saludable' }
docker restart media
if ($LASTEXITCODE -ne 0) { throw 'No se pudo reiniciar Media' }
$after = docker exec postgres_media psql -U postgres -d media_db -Atc "SELECT row_to_json(m) FROM media m WHERE id_media=$mediaId;"
if ($LASTEXITCODE -ne 0 -or $before -cne $after) { throw 'La referencia cambio tras reiniciar' }
'Persistencia comprobada: fila completa identica'
```

Estos bloques son instrucciones de reproduccion; la evidencia ejecutada arriba utilizo registro sintetico en IAM y una imagen generada en memoria, no este login interactivo. No se afirma haber ejecutado estos bloques textualmente.

## Criterios y traspaso

| Criterio del alcance local acordado | Evidencia | Estado |
|---|---|---|
| Media construye, inicia y realiza su subida existente | Imagen construida, sesion IAM, 201 y URL 200 | Verificado |
| Referencias disponibles tras reinicio | Fila completa de referencia 9 identica antes/despues | Verificado |
| Configuracion reproducible sin secretos | Compose, plantilla de variables y pasos anteriores | Documentado |
| Regresion del defecto de arranque | Tests de proceso y ejecuciones negativas en contenedor | Verificado |
| Despliegue y persistencia en Kubernetes | A cargo de otro integrante | No ejecutado aqui |

Para el responsable de Kubernetes: construir con contexto backend-go y SERVICE_PATH=cmd/media; puerto HTTP 8083; variables DB_*, JWT_SECRET compatible con IAM y CLOUDINARY_*; PostgreSQL debe conservar su volumen. Media termina con error si no puede conectar al arrancar. /healthz refleja disponibilidad de BD y no comprueba Cloudinary: no tratar una caida de BD como motivo automatico de reinicios masivos de liveness. La imagen scratch requiere un directorio temporal escribible para lotes multipart grandes. Los manifiestos existentes no se modificaron.

La implementacion y comprobacion local de ALL-145 quedan listas para entrega. El PR y el push siguen pendientes de autorizacion; no se marca el ticket externamente. ALL-146 sigue a continuacion con la matriz de errores y ejemplos para el consumidor, sin mezclarla con la integracion del cliente de ALL-183.

## ALL-146: revision del contrato y de la persistencia

Estado: revision estatica y matriz de integracion real completadas localmente; publicacion pendiente. Rama `ALL-146-media-contrato-integracion`, base `f0c5ff3` de origin/develop, que incorpora ALL-145 mediante PR #342. La nota anterior de push pendiente describe el momento de entrega de ALL-145, no su estado actual.

### Recorrido revisado

| Capa | Archivo | Responsabilidad y observacion |
|---|---|---|
| Arranque | [cmd/media/main.go](../backend-go/cmd/media/main.go) | Conexion, AutoMigrate del modelo Media, repositorio GORM, registro HTTP y autorizacion |
| API | [media_handler.go](../backend-go/internal/api/media/media_handler.go) | Multipart, normalizacion de tipo, archivo unico, respuesta 201 y errores |
| Autorizacion | [jwt_http.go](../backend-go/internal/middleware/jwt_http.go) | Bearer JWT y user_id; no recibe el usuario desde el multipart ni consulta IAM en cada subida |
| Servicio | [media_service.go](../backend-go/internal/service/media/media_service.go) | Politicas PERFIL/PORTADA; sube y despues persiste referencia |
| Pipeline | [upload_service.go](../backend-go/internal/service/media/upload_service.go) | Lee, valida, procesa y envia bytes a Cloudinary |
| Validacion | [validator.go](../backend-go/internal/service/media/validator.go) | Peso y MIME detectado por contenido |
| Procesamiento | [processor.go](../backend-go/internal/service/media/processor.go) | JPEG/PNG/WebP a JPEG; AVIF sin transformar |
| Modelo | [models/media.go](../backend-go/internal/models/media.go) | Tabla media, PK id_media, public_id unico, indice usuario/tipo; no guarda binarios |
| Conexion | [database/postgres.go](../backend-go/internal/database/postgres.go) | Configuracion DB_* y conexion GORM compartida |
| Contrato IAM | [auth.proto](../backend-go/api/proto/auth.proto) | URLs de perfil/portada en mensajes de IAM, no subida multipart |
| Generados | [auth.pb.go](../backend-go/internal/api/pb/auth/auth.pb.go) | Campos y numeros revisados contra auth.proto; no editados ni regenerados |

Media no tiene un proto de subida: su contrato es HTTP implementado manualmente. Los .pb de IAM son contratos de transporte, no esquemas de PostgreSQL. Se comprobaron los numeros de foto_perfil_url/portada_url: ProfileResponse 10/12, UpdateProfileRequest 6/7 y PublicProfileResponse 8/9. Coinciden con el Go generado revisado. No se afirma que se hayan regenerado o auditado todos los protobuf del monorepo.

El servicio IAM consume las URLs mediante UpdateProfile y las guarda en su modelo Perfil. Subir a Media NO actualiza por si solo el perfil de IAM. Tampoco existe una FK entre las bases independientes: el modelo Media almacena id_usuario procedente del token. La estructura real de BD y sus indices se consultaron en la ejecucion descrita mas abajo.

### Contrato revisado en codigo

- POST /v1/media/upload; Authorization: Bearer; Content-Type multipart/form-data con boundary generado por el cliente.
- Campo `file`: exactamente un archivo. Campo `tipo`: PERFIL o PORTADA; se recortan espacios y convierte a mayusculas.
- Maximo individual: 5,242,880 bytes (5 MiB). Limite total de cuerpo: 6,291,456 bytes, incluido multipart.
- Formatos por contenido: JPEG, PNG, WebP, AVIF. No basta extension o Content-Type declarados.
- Dimensiones maximas PERFIL 512, PORTADA 1600; AVIF es excepcion porque pasa sin redimensionar.
- Exito 201: objeto directo con `id`, `tipo`, `url`, `publicId`. No tiene envoltorio `data` ni campo `success`.
- Error: objeto directo `{"error":"mensaje"}`. Tipo invalido/archivo ausente 400, sesion invalida 401, peso excesivo 413, formato no admitido 415. Errores internos 500. Repositorio nulo 503 en el servicio; el nuevo arranque evita iniciar en ese estado.
- /upload/multiple es otro contrato: campo files, respuesta success/files, sin middleware HTTPAuth en el registro actual y sin persistencia de referencias por MediaService. No usarlo como sustituto para perfil.

### Matriz inicialmente planificada

| Caso | Preparacion | Resultado esperado por codigo |
|---|---|---|
| Nominal perfil y portada | Imagen sintetica y sesion IAM | 201, URL accesible y fila coincidente |
| Tipo invalido | tipo=OTRO, archivo valido | 400, sin nuevas referencias |
| Formato invalido | Texto bajo nombre .png | 415, sin nuevas referencias |
| Archivo excesivo | 5 MiB + 1 byte, cuerpo menor de 6 MiB | 413 del validador, sin nuevas referencias |
| Cuerpo excesivo | Multipart mayor de 6 MiB | 413 del lector HTTP, sin nuevas referencias |
| Sin sesion / token invalido | Omitir Bearer / token malformado | 401, sin nuevas referencias |
| Campo incorrecto / varios archivos | files en vez de file / dos partes file | 400, sin nuevas referencias |

La estrategia fue comparar referencias antes/despues de cada rechazo, sin inferir ausencia de persistencia solo por el status HTTP, y capturar JSON sin credenciales para ALL-183. El bloqueo inicial por Docker no disponible quedo resuelto; los resultados efectivos se detallan abajo. En la corrida final de tipo=OTRO se envio texto bajo nombre .png: el 400 comprueba que la validacion de tipo precede a la de contenido. No debe confundirse esa entrada con la imagen valida prevista en esta matriz inicial.

### Hallazgos y limites de la revision

- Fallo de BD posterior a subir puede dejar asset huerfano: limitacion conocida, no resuelta aqui.
- El mapper HTTP concatena errores internos en respuestas 500; conviene sanitizarlos en una correccion acotada con regresion, sin divulgar credenciales en evidencia. No se ha provocado un fallo real del proveedor en esta etapa.
- La autorizacion verifica firma/claims, no vigencia del usuario en BD IAM; no se acredita revocacion o desactivacion inmediata.
- Las limitaciones de AVIF, transparencia PNG y consumo de memoria siguen pendientes. Esta revision no autoriza alterar formatos o reglas silenciosamente.
- No se modifico codigo de aplicacion, contratos, modelos ni archivos generados. La matriz real inicialmente bloqueada se completo en la ejecucion descrita a continuacion.

### ALL-146: resultados reales, 16 de noviembre de 2026

Docker Desktop estaba activo pero los contenedores detenidos. Se levantaron media, iam y ambas BD con Compose, conservando volumenes. Imagen Media comprobada: sha256:77459b035c28c7bf33d2e74e534ec41de4346ef45835b971b9a8eea644285160. El codigo de Media y jwt_http no difiere entre cb3cd8e y la base f0c5ff3. Las pruebas son locales, no de Kubernetes ni de un navegador.

Esquema real consultado con `docker exec postgres_media psql -U postgres -d media_db -c '\d media'`: id_media/id_usuario bigint; tipo varchar(20); url varchar(500); public_id varchar(255); fecha_creacion timestamptz. PK media_pkey, UNIQUE idx_media_public_id e indice idx_media_usuario_tipo. Todos los campos excepto fecha_creacion son NOT NULL. Sin FK a IAM. Coincide con el modelo revisado; no se altero el esquema.

Se usaron cuentas sinteticas registradas realmente en IAM, con password aleatoria y token mantenidos en memoria. Imagen PNG sintetica de 2000x1000 creada en memoria. Cliente System.Net.Http.HttpClient y MultipartFormDataContent, que genera el boundary; nombres file/tipo. La descarga desde Cloudinary no incluye el Bearer de IAM.

| Caso ejecutado | HTTP | Comprobacion |
|---|---:|---|
| PERFIL con espacios/minusculas | 201 | id=11, PERFIL normalizado, 512x256, URL descargable; filas 8 a 9 |
| PORTADA | 201 | id=12, 1600x800, URL descargable; filas 9 a 10 |
| tipo=OTRO | 400 | Tabla identica |
| Texto de 5 bytes con nombre .png y MIME declarado image/png | 415 | Tabla identica |
| Archivo de 5,242,881 bytes, cuerpo menor de 6 MiB | 413 | Tabla identica |
| Archivo de 6,291,457 bytes, cuerpo mayor de 6 MiB | 413 | Tabla identica |
| Sin Authorization | 401 | Tabla identica |
| Bearer malformado/invalid-token | 401 | Tabla identica |
| Campo files en lugar de file | 400 | Tabla identica |
| Dos partes file | 400 | Tabla identica |
| Sin parte de archivo | 400 | Tabla identica |
| Archivo de cero bytes | 400 | Tabla identica |

En ambos exitos se verificaron id, tipo, URL y publicId contra la fila guardada, incremento de exactamente una fila y usuario perteneciente a la cuenta de prueba IAM. En los diez rechazos se verificaron status, Content-Type application/json, propiedad error y tabla sin cambios. La consulta anterior/posterior fue:

```sql
SELECT count(*) || ':' || md5(coalesce(json_agg(m ORDER BY id_media)::text,'[]'))
FROM media m;
```

La huella cubre el contenido ordenado completo de la tabla, no solo el conteo. Es una comprobacion de cambios, no un mecanismo criptografico de seguridad ni prueba de ausencia de assets remotos; no se inspecciono el inventario de Cloudinary para cada rechazo. El flujo de codigo rechaza estos casos antes de subir.

Nota de ejecucion: dos intentos iniciales del script fallaron al comparar arrays/objetos devueltos por PowerShell. No fueron pruebas aprobadas ni defectos demostrados de Media. La comprobacion final utiliza conteos SQL explicitos y salida escalar normalizada con Out-String.Trim(). Se conservaron tres nuevas referencias (10, 11 y 12) y tres assets de esta tarea; la 10 corresponde a la primera subida cuya comprobacion se interrumpio. Se crearon tres cuentas sinteticas al repetir los scripts, sin modificar usuarios existentes. Conteo previo a ALL-146: 7; final: 10. No se borraron datos para ocultar intentos fallidos.

### Ejemplos reales para el consumidor de perfil

Respuesta de perfil observada, sin credenciales (asset sintetico):

```json
{"id":11,"tipo":"PERFIL","url":"https://res.cloudinary.com/rstk3bky/image/upload/v1794883588/media/perfil/gwvbk1tyvbnko8gxtglk.jpg","publicId":"media/perfil/gwvbk1tyvbnko8gxtglk"}
```

Respuesta de portada observada:

```json
{"id":12,"tipo":"PORTADA","url":"https://res.cloudinary.com/rstk3bky/image/upload/v1794883590/media/portada/arrgtcihsuwyxe9puxip.jpg","publicId":"media/portada/arrgtcihsuwyxe9puxip"}
```

URLs publicas de prueba, verificadas durante la ejecucion; pueden dejar de existir si se limpian los assets. No deben codificarse como valores permanentes del frontend.

Errores observados (el status HTTP se recibe fuera del JSON):

```json
{"error":"tipo inválido: debe ser PERFIL o PORTADA"}
```

```json
{"error":"\"all146.png\" (text/plain; charset=utf-8, 5 bytes): media: el contenido real del archivo no es una imagen soportada"}
```

```json
{"error":"\"all146.png\" (5242881 bytes): media: el archivo excede el peso máximo permitido"}
```

```json
{"error":"el archivo excede el límite permitido"}
```

```json
{"error":"token de autorización no proporcionado"}
```

```json
{"error":"token inválido o expirado"}
```

```json
{"error":"se debe enviar exactamente un archivo en el campo 'file'"}
```

```json
{"error":"\"all146.png\" (0 bytes): media: el archivo está vacío"}
```

Para ALL-183: usar status HTTP para categorizar errores y error como detalle; no analizar el texto buscando palabras. Enviar FormData sin Content-Type manual. Adaptar la URL del objeto directo, no data.url. Guardar foto/portada en IAM es una operacion posterior distinta. Un fallo de red no garantiza que la subida no se haya completado: no repetir automaticamente una solicitud de resultado desconocido, ya que no existe idempotencia comprobada.

### Reproduccion de los rechazos y limites

Reutilizar autenticacion y cliente multipart documentados en ALL-145. Antes/despues de cada solicitud ejecutar la consulta de huella con docker exec; convertir su salida a un unico string mediante `(salida | Out-String).Trim()` en Windows PowerShell. Para formato usar UTF8.GetBytes('texto'); para pesos usar byte[5242881] y byte[6291457]; para vacio byte[0]. Para sesion omitir Authorization o usar Bearer invalid-token. Alterar tipo/campo/cantidad segun la tabla. Conservar response.StatusCode y JSON, pero nunca token/password. No es necesario un nuevo endpoint o un protobuf de Media.

No se provoco caida de Cloudinary/BD ni se simulo expiracion temporal de un JWT real: el mensaje 'invalido o expirado' observado corresponde al token malformado. Tampoco se certifican revocacion, cancelacion, navegadores, todos los formatos o cuotas de Kubernetes. El pendiente de sanitizar errores 500 sigue separado; no fue necesario cambiar codigo para que pasaran los casos exigidos por esta tarea. No hay nueva prueba de regresion de un fix porque no se implemento un fix en ALL-146.

### Comprobaciones existentes y entrega

Desde [backend-go](../backend-go), se ejecutaron tambien las comprobaciones existentes:

```powershell
go test -count=1 ./cmd/media ./internal/api/media ./internal/service/media ./internal/middleware
go vet ./cmd/media ./internal/api/media ./internal/service/media
```

Resultado: los cuatro paquetes de test aprobaron; go vet termino con codigo 0, sin diagnosticos. Estas comprobaciones complementan, pero no sustituyen, las solicitudes de integracion real anteriores.

| Criterio de ALL-146 | Evidencia y resultado |
|---|---|
| URL/referencia valida y errores consistentes | Dos exitos completamente comprobados: referencias 11/12, descarga y dimensiones verificadas; diez rechazos con status y JSON comprobados |
| Rechazos sin referencias persistidas como exito | Conteo y huella de toda la tabla sin cambios antes/despues de cada rechazo |
| Contrato con ejemplos sin credenciales | Campos, limites, autenticacion, respuestas reales y pasos de reproduccion en este documento |

Tarea: [ALL-146](https://linear.app/allin1/issue/ALL-146/sprint-final-s2-media-verificar-el-contrato-de-subida-y-sus-errores-de). Dependencia incorporada: [PR #342 de ALL-145](https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/342). El unico archivo afectado en esta entrega es este documento; no se modificaron codigo, contratos, protobuf, esquema ni manifiestos. Los pendientes funcionales estan enumerados en la seccion de hallazgos y no se declaran resueltos.

Conclusion: contrato y rechazos solicitados verificados con HTTP, IAM, Cloudinary y PostgreSQL reales en local. Alcance tecnico de ALL-146 completado en ese entorno. Queda publicar la rama, abrir el PR y enlazarlo en Linear; el push requiere autorizacion del usuario. No se cerro el ticket externamente. ALL-183 queda como siguiente tarea, sin acreditar aqui su integracion frontend.

## ALL-183: cliente multipart del frontend

Ejecucion: 17 de noviembre de 2026, Docker local y navegador en http://localhost:3001. Rama `ALL-183-media-cliente-multipart`, creada desde `174e314` para conservar la evidencia de ALL-146 (ya publicada; no se presupone su merge). Al abrir el PR hacia develop, incorporar primero ALL-146 o advertir que su commit tambien aparece en el diff.

### Cambios y consumo

- [mediaService.ts](../frontend-marketplace/src/services/mediaService.ts): `uploadMedia(file, tipo, signal?)` reutiliza el cliente autenticado y devuelve el objeto directo `{ id, tipo, url, publicId }`. Exporta tipos y `MediaUploadError` con kind/status/message. No actualiza el perfil IAM ni reintenta automaticamente.
- [pagina de prueba existente](../frontend-marketplace/src/app/test-media/page.tsx): utiliza el servicio, elimina el ingreso manual de JWT y permite cancelar. No se creo otra pantalla ni endpoint. El formulario definitivo de perfil queda para semana 3.
- [.env.example](../frontend-marketplace/.env.example): `NEXT_PUBLIC_MEDIA_API_URL`, con default local 8083. Es una URL publica incorporada en build, no un secreto; no se modifico .env.local ni Kubernetes.
- [mediaService.test.mjs](../frontend-marketplace/src/services/mediaService.test.mjs): regresiones con node:test y dependencias ya instaladas. Estas pruebas sinteticas no sustituyen la integracion real descrita abajo.

La solicitud envia FormData con `file` y `tipo`, elimina el Content-Type JSON heredado y deja que el navegador genere el boundary. Se configura `withCredentials: false` solo para Media: el interceptor sigue enviando Authorization Bearer, pero no cookies entre origenes. La primera prueba real detecto que heredar `withCredentials: true` bloqueaba el preflight porque Media no habilita Access-Control-Allow-Credentials. Se corrigio el cliente, sin ampliar el CORS del backend.

Errores disponibles: format (400/415), size (413), session (401/403), network (sin respuesta), cancelled, server y response (respuesta no conforme). Se conserva el comportamiento global existente de redireccion al login ante 401. Cancelar o perder conexion no implica revertir una subida ya recibida por el servidor; no hay reintentos automaticos.

Ejemplo para el futuro formulario:

```typescript
import { uploadMedia, MediaUploadError } from '@/services/mediaService';

const controller = new AbortController();
try {
  const media = await uploadMedia(file, 'PERFIL', controller.signal);
  // media.url y media.publicId disponibles. Guardar el perfil IAM es otra operacion.
} catch (error) {
  if (error instanceof MediaUploadError) {
    // Clasificar por error.kind/status; mostrar error.message sin analizar su texto.
  }
}
// Para cancelar mientras la promesa esta pendiente: controller.abort().
```

### Evidencia de navegador y BD

Se registro una cuenta sintetica por IAM; token y password no se incluyen. Se creo un PNG negro de 2000x1000 en memoria y se selecciono en el input de la pagina existente. El cliente ejecutado fue el servicio frontend real, no un fetch sustituto para la subida.

| Caso | Resultado observado |
|---|---|
| PERFIL PNG | 201, Authorization presente sin exponer su valor; Content-Type multipart/form-data con boundary WebKit generado por el navegador |
| Imagen retornada | Referencia 13, publicId media/perfil/gidumpvs0mnrywyuy9zs; imagen cargada en la pagina, dimensiones 512x256 |
| Persistencia | SELECT de referencia 13 coincide con respuesta; id_usuario 31; conteo total 11 (era 10 al finalizar ALL-146) |
| Texto de 5 bytes nombrado all183.png | 415; pagina muestra categoria format y mensaje del backend |
| Archivo de 5,242,881 bytes | 413; pagina muestra categoria size y mensaje del backend |
| Sin cookie de sesion, archivo pequeno | HTTP 401 observado y redireccion real a /login?session=expired; la navegacion impidio recuperar el JSON con la herramienta, por lo que no se acredita captura del cuerpo en este caso |
| Sin sesion, conservando el archivo grande | El navegador recibio ERR_CONNECTION_RESET y mostro network. No se atribuye un status HTTP ni una causa confirmada a ese intento |

URL publica sintetica comprobada: https://res.cloudinary.com/rstk3bky/image/upload/v1794886307/media/perfil/gidumpvs0mnrywyuy9zs.jpg. Puede desaparecer al limpiar datos; no incorporarla como valor fijo del formulario. Se conserva una cuenta y una referencia/asset nuevos, sin borrar datos existentes.

La cancelacion previa y durante la solicitud se comprueba con adaptador sintetico; no se declara una cancelacion real del procesamiento remoto. No se comprobaron todos los formatos, portada desde navegador ni despliegue Kubernetes. Los casos de backend de ALL-146 siguen siendo evidencia separada.

### Reproduccion y validacion

Con Media/IAM y sus BD activos, ejecutar desde [frontend-marketplace](../frontend-marketplace):

```powershell
npm run dev -- --port 3001
node --test src/services/mediaService.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/services/mediaService.ts src/services/mediaService.test.mjs src/app/test-media/page.tsx
```

Iniciar sesion con una cuenta de prueba y abrir /test-media. Si se usa el login normal, configurar NEXT_PUBLIC_API_URL al gateway operativo o IAM local (8081) antes de iniciar Next. En esta ejecucion se registro la cuenta contra IAM directamente desde el navegador y se guardo la cookie de prueba en memoria del navegador, sin modificar configuracion local. Seleccionar una imagen, subir y comprobar respuesta, imagen y Network. Repetir con texto .png y archivo mayor de 5 MiB. Para cancelar, usar el boton durante una solicitud pendiente; no asumir que elimina el asset.

No se instalo ninguna dependencia ni se modifico el cliente global de autenticacion. El puerto 3000 estaba ocupado por Grafana; 3001 ya estaba permitido por Media. La entrega cubre el consumidor reutilizable y su comprobacion real, no el guardado definitivo del formulario de perfil.

Resultado final: 11 pruebas de regresion aprobadas; TypeScript sin errores; ESLint de los tres archivos de codigo/pruebas sin diagnosticos; git diff --check sin errores (solo aviso de conversion LF/CRLF del documento). No se ejecuto build de produccion ni lint global del monorepo. Criterios locales de ALL-183 cubiertos: subida real consumible, boundary del navegador, tipos y errores disponibles para el formulario. Publicacion y enlace del PR pendientes; no se cerro Linear ni se realizo push automaticamente.

## ALL-157: foto de perfil con Media e IAM (semana 3)

Inicio: 20/11/2026. Base `develop` en `9f81985`, limpia tras finalizar el pull. Rama `ALL-157-perfil-foto-persistente`. La base incorpora ALL-139 (PR #347), ALL-146 (PR #346) y ALL-183 (PR #348), ademas de ALL-145. Esta comprobacion de codigo integrado no acredita disponibilidad del entorno ni cambia estados en Linear.

### Implementacion

- [profile-edit-modal.tsx](../frontend-marketplace/src/components/shared/profile-edit-modal.tsx): selector de foto; subida PERFIL con el cliente existente; estados separados de subida y guardado; errores de Media separados de IAM. No sustituye la imagen visible con una vista previa. Retiene la URL subida mientras el modal siga abierto para reintentar solo IAM; seleccionar otro archivo descarta esa URL pendiente. Bloquea envios duplicados y cierre durante el procesamiento.
- [profile.ts](../frontend-marketplace/src/types/profile.ts) y [mappers/auth.ts](../frontend-marketplace/src/lib/mappers/auth.ts): URL opcional en el formulario y campo fotoPerfilUrl en el PUT existente, solo cuando hay valor. Sin URL nueva no envia referencia vacia ni modifica portada. IAM ya conserva foto/portada cuando esos campos llegan vacios.
- [perfil/page.tsx](../frontend-marketplace/src/app/perfil/page.tsx): comprueba sesion antes del PUT y despues de la respuesta, y exige coincidencia de la foto solicitada con la devuelta antes de actualizar estado/avatar y anunciar exito.
- [authService.test.mjs](../frontend-marketplace/src/services/authService.test.mjs): dos regresiones adicionales sobre envio de URL, recuperacion del avatar y omision de foto/portada cuando no se cambian. Se reutiliza el archivo existente.

Portada NO implementada ni acreditada. Sin cambios de backend, protobuf, almacenamiento, autenticacion global ni Kubernetes. La vista publica ya consume fotoPerfilUrl; sus datos de ejemplo en otras secciones siguen siendo una limitacion ajena al guardado de foto y no sirven como evidencia real.

### Comprobaciones y pendientes

Desde frontend-marketplace: `node --test src/services/authService.test.mjs src/services/mediaService.test.mjs`: 16 pruebas aprobadas. `node node_modules/typescript/bin/tsc --noEmit --incremental false`: codigo 0. Estas comprobaciones son sinteticas/estaticas y NO acreditan persistencia real. `git diff --check`: sin errores.

El bloqueo inicial por Docker Desktop no disponible fue resuelto por el usuario. El 21/11/2026 el agente comprobo IAM y Media activos, ambas BD saludables y CORS de IAM permitido desde localhost:3001. La validacion funcional posterior fue realizada manualmente por el usuario, no por el agente.

El usuario confirmo expresamente en el chat que la URL coincide en Media e IAM para el mismo usuario, que la foto permanece al recargar el perfil propio y publico, y que un archivo invalido se rechaza conservando la foto anterior. Entorno local Docker, IAM 8081, Media 8083 y frontend indicado en 3001. Se registra como resultado manual reportado, no como captura automatizada. No se proporcionaron identificador de cuenta, archivo exacto, URLs, capturas ni trazas HTTP de esa ejecucion; esos detalles no se inventan. Para trazabilidad completa de la cuenta y ambas etapas conviene adjuntar evidencia anonimizada al PR. No se reutilizan los resultados de ALL-183 como prueba de este recorrido.

Procedimiento reproducible: iniciar Docker y servicios Media/IAM con sus BD, comprobar que la imagen IAM incorpora ALL-139, iniciar frontend con URL de IAM/gateway operativo, entrar con cuenta de prueba, abrir edicion de perfil, seleccionar PNG valido y guardar. Resultado esperado: POST Media 201 seguido de PUT IAM satisfactorio con la misma URL; comprobar la fila IAM y recargar perfil propio y publico. Repetir rechazo de archivo conservando una foto ya guardada. La confirmacion manual anterior cubre los resultados funcionales, no documenta los status HTTP individuales. Fallos controlados adicionales corresponden a ALL-158; dos cuentas y reinicio a ALL-189. No se acreditan portada, build de produccion ni Kubernetes.

Riesgo residual: Media puede guardar un archivo aunque falle IAM; no existe compensacion automatica. Dentro del modal se puede reintentar Guardar sin otra subida; al cerrarlo o recargar se pierde la URL pendiente y puede quedar un asset sin asociar. Ante perdida de respuesta, recargar primero permite consultar si IAM alcanzo a guardar. No se afirma que un error de red revierta persistencia ni se borran assets automaticamente.

## ALL-158: fallos de subida y conservacion de referencias

Fecha: 21/11/2026 (America/Santiago). Rama `ALL-158-media-fallos-referencias`, base `7e44a81` de origin/develop. ALL-157 ya incorporada mediante PR #351. [Ticket ALL-158](https://linear.app/allin1/issue/ALL-158/sprint-final-s3-media-mvp-comprobar-fallos-de-subida-y-conservar).

### Analisis y alcance ejecutado

El modal de ALL-157 ya separa uploadMedia y onSave, retiene la URL subida en memoria y no cierra en caso de error. El padre solo actualiza la foto visible despues de validar la respuesta de IAM y la sesion. No se detecto una inconsistencia que requiriera modificar codigo de aplicacion. Se amplio [authService.test.mjs](../frontend-marketplace/src/services/authService.test.mjs) con tres pruebas de logica del modal usando hooks simulados y su fuente real: rechazo de subida sin llamar a IAM, rechazo de IAM seguido de reintento sin segunda subida, y fallo de red sin confirmacion de exito. No equivalen a pruebas visuales de navegador.

Para la integracion real se eligio un fallo controlado de validacion de IAM (telefono INVALIDO), no una caida de BD/proveedor. Es suficiente para comprobar el caso de archivo aceptado por Media seguido de guardado rechazado, sin detener servicios ni alterar datos de otros usuarios. No se implementaron colas, limpieza ni compensaciones.

### Entorno y evidencia real

Docker local, IAM en 8081, Media en 8083, postgres_iam/iam_db y postgres_media/media_db. Se iniciaron los contenedores detenidos con `docker compose up -d iam media`, sin eliminar volumenes. Advertencia preexistente: POSTGRES_PASSWORD_ORDERS no configurada; no se cambio por esta tarea. Imagen IAM `sha256:3e742f8ce1cc3b5816b5723eeb32944c6ca85ced47a3a2b664597185a37b116f`; Media `sha256:694f910612fe9e417b31be0994898e2ca75374fd60d25bafc87103c20001cf40`. No se reconstruyeron imagenes en esta ejecucion ni se certifica correspondencia binaria con todo HEAD; el contrato usado se comprobo en las solicitudes reales.

Cuenta sintetica creada en IAM: id_usuario **32**, nombre de prueba, correo aleatorio example.invalid. Credenciales y token mantenidos solo en memoria del proceso. PNG RGB sintetico 2x2 generado en memoria; sin datos personales. Cliente HTTP Node fetch/FormData contra servicios reales, sin interceptar ni simular respuestas. Se compararon GET privado antes/despues y consultas SQL limitadas a esa cuenta.

| Paso | Resultado esperado | Observado |
|---|---|---|
| Subir imagen A y asignarla al perfil | Media 201 e IAM 200; URL coincidente | Referencia Media 16; IAM y SQL contienen URL A |
| Subir texto `texto` (5 bytes), nombre all158.png, MIME declarado image/png | 415 y perfil sin cambios | 415; GET privado identico, SQL IAM conserva A y conteo Media del usuario sigue en 1 |
| Subir imagen B | 201, aun sin cambiar IAM | Referencia Media 17; segunda fila de Media |
| PUT perfil con URL B y telefono INVALIDO | IAM 400; conserva A | 400 code=3; GET privado identico al anterior; SQL IAM conserva A; Media conserva sus dos filas |
| Reintentar PUT con URL B y telefono vacio | 200 sin otra subida | 200; GET privado y SQL IAM contienen B; conteo Media sigue en 2 |

URL A: https://res.cloudinary.com/rstk3bky/image/upload/v1795315198/media/perfil/xtvowdybhxcljsy9xpuo.jpg

URL B: https://res.cloudinary.com/rstk3bky/image/upload/v1795315202/media/perfil/bqtldlvikdznlusoeozd.jpg

Son assets sinteticos publicos de prueba, no valores para codificar en el frontend. En esta ejecucion no se verificaron descarga/dimensiones de salida; corresponden a ALL-189. Se conservaron una cuenta y dos referencias/assets nuevos. No se borraron registros ni archivos remotos.

Respuestas reales de rechazo:

```json
{"error":"\"all158.png\" (text/plain; charset=utf-8, 5 bytes): media: el contenido real del archivo no es una imagen soportada"}
```

```json
{"code":3,"message":"el teléfono debe tener entre 7 y 20 caracteres y solo dígitos, espacios, +, - o paréntesis","details":[]}
```

### Pasos reproducibles y reintento

1. Iniciar servicios locales y registrar/iniciar sesion con una cuenta exclusiva de prueba. No utilizar produccion.
2. Subir un PNG valido como `file`, `tipo=PERFIL`, a POST /v1/media/upload con Bearer. Guardar su URL mediante PUT /v1/auth/profile y consultar GET del mismo endpoint. Esta es la foto A vigente.
3. Repetir la subida con texto disfrazado de PNG. Comparar GET del perfil y conteo Media antes/despues; esperar 415, ninguna nueva referencia y foto A intacta.
4. Subir otro PNG B y guardar su URL con telefono INVALIDO, campos ciudad/region/bioExperiencia/habilidades vacios. Esperar 400 de IAM y consultar de nuevo: foto A permanece, aunque B ya existe en Media.
5. Reenviar solo PUT IAM con la misma URL B y telefono vacio/valido. Esperar 200 y recuperar B con GET/SQL; no llamar de nuevo a Media.

Consultas de evidencia de esta ejecucion (sustituir 32 por la cuenta propia al reproducir):

```powershell
docker exec postgres_media psql -U postgres -d media_db -c "SELECT id_media,id_usuario,tipo,url FROM media WHERE id_usuario=32 ORDER BY id_media;"
docker exec postgres_iam psql -U postgres -d iam_db -c "SELECT id_usuario,foto_perfil_url FROM perfiles WHERE id_usuario=32;"
```

En la UI existente, corregir el telefono y pulsar Guardar de nuevo con el mismo modal abierto reutiliza la URL B. La logica de ese comportamiento se comprobo sinteticamente. Seleccionar otro archivo, cerrar el modal o recargar descarta la URL pendiente; no limpia Cloudinary. Ante error de red de resultado desconocido, consultar primero el perfil antes de reintentar. Nunca afirmar que cancelar o perder conexion revierte un guardado.

### Resultados, limites y estado

`node --test src/services/authService.test.mjs src/services/mediaService.test.mjs`: **19 pruebas aprobadas**. La integracion HTTP/SQL real anterior es evidencia separada, no depende de mocks.

ESLint del archivo de pruebas modificado: sin diagnosticos. TypeScript (`tsc --noEmit --incremental false`): codigo 0. Diagnosticos del editor y `git diff --check`: sin errores. No se ejecuto build de produccion ni lint global.

No se logro abrir/leer el navegador integrado: la comprobacion visual de mensajes, foto conservada y reintento desde el formulario NO se ejecutó en esta tarea. Se inicio el frontend en 3001, pero la evidencia de esta entrega es HTTP/BD real y logica del modal con hooks simulados. No se declara una nueva validacion visual end-to-end; puede completarse manualmente con los pasos anteriores.

Riesgo residual demostrado: despues del 400, la imagen B ya estaba registrada en Media pero no asociada al perfil IAM. El reintento la asocio; la imagen A permanece como subida historica. No hay compensacion ni limpieza automatica. No se provocaron caidas de Cloudinary, fallos de escritura de BD ni fallos sobre produccion. Portada, dos cuentas y reinicio quedan fuera de ALL-158. No se cerraron tickets ni se hizo push automaticamente.
