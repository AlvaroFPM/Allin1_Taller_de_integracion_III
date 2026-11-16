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
