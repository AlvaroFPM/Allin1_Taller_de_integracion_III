# ALL-174 — Comprobación de equivalencia y revisión de cambios (IAM)

- **Responsable:** Amaro
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `chore/174-iam-verificar-equivalencia-refactor`
- **Base de comparación:**
  - **Antes:** `fb5fa8a` (`C:/Users/Amaroo/AppData/Local/Temp/all128-antes-b8c8493a5e54428f8cd45d82269903d2`)
  - **Después:** `67f95d3` (`C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III`)
- **Refactor evaluado:** ALL-128 — PR #338 (`https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/338`)
- **Fecha de ejecución:** 16-11-2026
- **Método de ejecución HTTP:** Opción A — `go run cmd/iam/main.go` desde `backend-go/` con `DB_HOST=localhost`, `DB_PORT=5433`, `DB_USER=postgres`, `DB_NAME=iam_db`, `DB_SSLMODE=disable`, `HTTP_PORT=8085`, `GRPC_PORT=50055`, conectado al contenedor local `postgres_iam` (healthy en puerto 5433).
  - *Bloque 1 (ANTES):* Respondió commit `fb5fa8a`.
  - *Bloque 2 (DESPUÉS):* Respondió commit `67f95d3`.

---

## 1. Evidencia preexistente reutilizada (PR #338)

Conforme a las directrices de la tarea, se cita la evidencia preexistente registrada en el PR #338 sin duplicación innecesaria:
1. **Login válido:** verificado en ambas versiones; estado HTTP 200 OK, mismo `user_id` numérico emitido en claims del token JWT, vigencia de 24 horas (`exp` válido en el futuro), y acceso consistente a los datos del perfil privado del usuario.
2. **Backend Go CI:** flujo de integración continua aprobado exitosamente para la rama del refactor.

---

## 2. Comprobaciones locales y resultados comparativos acotados a IAM

Comando ejecutado en ambos árboles desde `backend-go/` (con `POSTGRES_PASSWORD_IAM` exportada en sesión desde el contenedor `postgres_iam`):

```powershell
$env:POSTGRES_PASSWORD_IAM = docker exec postgres_iam printenv POSTGRES_PASSWORD
go test -v -count=1 -run "TestAuthService_Register|TestGetProfileByUserID|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUpdateProfileByUserID|TestUpdateProfile_UsaElUsuarioDelContexto|TestUnaryAuthInterceptor" ./internal/service/ ./internal/middleware/
go build ./cmd/iam/...
go vet ./internal/service/... ./internal/middleware/...
gofmt -l internal/service internal/middleware
```

### 2.1 Resultados de pruebas por suite

| Suite de pruebas / Test | Subcasos | Antes (`fb5fa8a`) | Después (`67f95d3` / PR #338) | Estado | Origen |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `TestAuthService_Register_Valid` | 1 | PASS (0.05s) | PASS (0.05s) | Idéntico | TEST |
| `TestAuthService_Register_InvalidEmail` | 1 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| `TestAuthService_Register_ShortPassword` | 1 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| `TestGetProfileByUserID` (con BD PostgreSQL 5433) | 3 | PASS (0.70s) | PASS (0.57s) | Idéntico | TEST |
| `TestUserIDFromContext` | 2 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| `TestValidateUpdateProfileRequest` | 8 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| `TestUpdateProfileByUserID` (con BD PostgreSQL 5433) | 7 | PASS (1.26s) | PASS (1.01s) | Idéntico | TEST |
| `TestUpdateProfile_UsaElUsuarioDelContexto` | 2 | PASS (0.20s) | PASS (0.16s) | Idéntico | TEST |
| `TestUnaryAuthInterceptor_RutasPublicas` | 7 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| `TestUnaryAuthInterceptor_RutasProtegidas` | 5 | PASS (0.00s) | PASS (0.00s) | Idéntico | TEST |
| **Total casos unitarios e integración IAM** | **37** | **37/37 PASS** | **37/37 PASS** | **Equivalente** | **TEST** |

> **Nota técnica de ejecución en Windows:** En el árbol DESPUÉS, la ejecución masiva directa vía `go test ./internal/middleware/` generó una restricción de política de seguridad local de Windows (WDAC / Device Guard sobre ejecutables efímeros en `%TEMP%`). La compilación y ejecución directa del binario de pruebas en el espacio de trabajo (`go test -c -o ./test_mw.exe ./internal/middleware && .\test_mw.exe -test.v`) ejecutó el 100% de los subtests con salida `PASS` idéntica.

### 2.2 Verificaciones complementarias

| Verificación | Antes (`fb5fa8a`) | Después (`67f95d3`) | Estado |
| :--- | :---: | :---: | :---: |
| `go build ./cmd/iam/...` | ExitCode: 0 | ExitCode: 0 | Idéntico |
| `go vet ./internal/service/... ./internal/middleware/...` | ExitCode: 0 | ExitCode: 0 | Idéntico |
| `gofmt -l internal/service internal/middleware` (Informativo) | Mismo listado (23 archivos preexistentes) | Mismo listado (23 archivos preexistentes) | Idéntico |

---

## 3. Tabla de equivalencia antes / después de casos funcionales

| Caso | Entrada | Salida/Efecto ANTES (`fb5fa8a`) | Salida/Efecto DESPUÉS (`67f95d3`) | Resultado | Origen de Evidencia |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Login inválido: usuario inexistente** | POST `/v1/auth/login` `{"email":"noexiste@example.com","password":"Password123!"}` | HTTP 401 Unauthorized, `code: 16` (`Unauthenticated`), `message: "credenciales incorrectas"` | HTTP 401 Unauthorized, `code: 16` (`Unauthenticated`), `message: "credenciales incorrectas"` | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Login inválido: contraseña incorrecta** | POST `/v1/auth/login` `{"email":"usuario...","password":"PasswordErronea1!"}` | HTTP 401 Unauthorized, `code: 16` (`Unauthenticated`), `message: "credenciales incorrectas"` | HTTP 401 Unauthorized, `code: 16` (`Unauthenticated`), `message: "credenciales incorrectas"` | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Login inválido: correo mal formado y contraseña vacía** | POST `/v1/auth/login` `{"email":"no-es-un-email","password":""}` | HTTP 400 Bad Request, `code: 3` (`InvalidArgument`) | HTTP 400 Bad Request, `code: 3` (`InvalidArgument`) | **IGUAL en estado y código** | HTTP (resultado reportado, texto exacto del mensaje pendiente de adjuntar) |
| **Perfil privado con token propio** | GET `/v1/auth/profile` Header: `Authorization: Bearer <token>` | HTTP 200 OK, devuelve todos los campos del usuario y perfil (incluyendo email y teléfono) | HTTP 200 OK, devuelve exactamente los mismos campos y valores | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Perfil privado sin token** | GET `/v1/auth/profile` Sin cabecera `Authorization` | HTTP 401 Unauthorized, `code: 16`, `message: "token de autorización no proporcionado"` | HTTP 401 Unauthorized, `code: 16`, `message: "token de autorización no proporcionado"` | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Perfil privado con token inválido** | GET `/v1/auth/profile` Header: `Authorization: Bearer token-invalido-o-expirado` | HTTP 401 Unauthorized, `code: 16`, `message: "token inválido o expirado"` | HTTP 401 Unauthorized, `code: 16`, `message: "token inválido o expirado"` | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Perfil público sin autenticación** | GET `/v1/auth/profile/{user_id}` Sin cabecera `Authorization` | HTTP 200 OK, expone campos públicos (`userId`, nombres, bio, habilidades, ciudad, región, URLs imágenes, rol). Omite datos privados (`email`, `telefono`) | HTTP 200 OK, misma exclusión estricta de datos de contacto y mismo orden de campos | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **Perfil público con ID no positivo** | GET `/v1/auth/profile/0` | HTTP 400 Bad Request, `code: 3` (`InvalidArgument`), `message: "user_id debe ser un número positivo"` | HTTP 400 Bad Request, `code: 3` (`InvalidArgument`), `message: "user_id debe ser un número positivo"` | **IGUAL** | HTTP (`curl.exe` real a puerto 8085) |
| **UpdateProfile: textos vacíos** | PUT `/v1/auth/profile` `bio_experiencia="", telefono="", habilidades="", ciudad="", region=""` | HTTP 200 OK, campos de texto en la base de datos se sobreescriben quedando vacíos (`""`) | HTTP 200 OK, campos de texto en la base de datos se sobreescriben quedando vacíos (`""`) | **IGUAL** | TEST (`TestUpdateProfileByUserID`, subcaso «campos vacíos reemplazan los valores guardados») + HTTP (resultado reportado, estado inicial de cada corrida pendiente de adjuntar) |
| **UpdateProfile: imágenes vacías** | PUT `/v1/auth/profile` `foto_perfil_url="", portada_url=""` | HTTP 200 OK, `fotoPerfilUrl` y `portadaUrl` conservan el valor previamente guardado | HTTP 200 OK, `fotoPerfilUrl` y `portadaUrl` conservan el valor previamente guardado | **IGUAL por código** | CÓDIGO (`backend-go/internal/service/auth_service.go:387-392`) + HTTP (resultado reportado, comparación antes y después de cada `PUT` pendiente de adjuntar) |
| **Identidad JWT: sin metadata** | Invocación gRPC a método protegido sin incoming context metadata | Error `codes.Unauthenticated`, `message: "metadata no proporcionada"` | Error `codes.Unauthenticated`, `message: "metadata no proporcionada"` | **IGUAL** | TEST (`TestUnaryAuthInterceptor_RutasProtegidas`) |
| **Identidad JWT: sin prefijo Bearer** | Invocación gRPC con header `Basic ...` | Error `codes.Unauthenticated`, `message: "formato de token inválido"` | Error `codes.Unauthenticated`, `message: "formato de token inválido"` | **IGUAL** | TEST (`TestUnaryAuthInterceptor_RutasProtegidas`) |
| **Identidad JWT: token malformado** | Invocación gRPC con token basura | Error `codes.Unauthenticated`, `message: "token inválido o expirado"` | Error `codes.Unauthenticated`, `message: "token inválido o expirado"` | **IGUAL** | TEST (`TestUnaryAuthInterceptor_RutasProtegidas`) |
| **Identidad JWT: ruta pública con token inválido/expirado** | Invocación gRPC a ruta pública (`GetPublicProfile`, `Login`, etc.) con token vencido | Trata la solicitud como visitante sin inyectar `UserIDKey`, continuando sin error | Trata la solicitud como visitante sin inyectar `UserIDKey`, continuando sin error | **IGUAL** | TEST (`TestUnaryAuthInterceptor_RutasPublicas`) |
| **Consistencia validación contexto: GetProfile vs userIDFromContext** | Extracción de identidad con valor de tipo no `uint` o con valor `uint(0)` | `GetProfile` retorna `Internal` ante tipo incorrecto y pasa `0` a persistencia; `userIDFromContext` retorna `Unauthenticated` en ambos casos | Comportamiento diferenciado conservado intacto (acorde a decisión H-01 de ALL-127) | **IGUAL** | CÓDIGO ([auth_service.go:186-195](file:///c:/Users/Amaroo/Desktop/Universidad/3er%20año/2do%20semestre/Integra%203/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go#L186-L195) vs [276-282](file:///c:/Users/Amaroo/Desktop/Universidad/3er%20año/2do%20semestre/Integra%203/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go#L276-L282)) |

---

## 4. Observaciones de la revisión del diff

Revisión archivo por archivo del diff entre `fb5fa8a` y `67f95d3`:

1. **`backend-go/cmd/iam/main.go:35`**:
   - *Descripción:* Corrección de tabulación en la llamada `log.Fatalf` dentro de la migración de `Usuario`.
   - *Severidad:* Informativa.
   - *Acción:* Conservada.
2. **`backend-go/cmd/iam/main.go:74`**:
   - *Descripción:* Simplificación idiomática de la inicialización del contexto HTTP a `ctx, cancel := context.WithCancel(context.Background())`. Se verificó que el orden de inicialización (conexión DB $\to$ servidor gRPC en goroutine $\to$ gateway HTTP en hilo principal) no sufrió alteración.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
3. **`backend-go/internal/middleware/jwt_interceptor.go:61-108`**:
   - *Descripción:* Sustitución de 6 llamadas literales a `status.Errorf` por `status.Error`. Códigos y mensajes gRPC idénticos al carácter.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
4. **`backend-go/internal/middleware/jwt_interceptor.go:68-75`**:
   - *Descripción:* Simplificación del condicional anidado de lectura de cabecera (`authorization` con fallback a `grpcgateway-authorization`), sustituyendo bloques anidados por fallback y retorno temprano.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
5. **`backend-go/internal/middleware/jwt_interceptor.go:68`**:
   - *Descripción:* Renombrado de variable ambigua `values` a `authHeaderValues`.
   - *Severidad:* Menor.
   - *Acción:* Aprobada (variable local sin consumidores externos).
6. **`backend-go/internal/service/auth_service.go:76-348`**:
   - *Descripción:* Sustitución de 19 llamadas a `status.Errorf` por `status.Error` en mensajes literales. Se preservaron intactas con `status.Errorf` las llamadas con especificadores de formato (`%s` en `validateImageURL` y `%v` en errores de GORM/bcrypt).
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
7. **`backend-go/internal/service/auth_service.go:93`**:
   - *Descripción:* Renombrado de variable ambigua `check` a `usuarioExistente` en `Register`.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
8. **`backend-go/internal/service/auth_service.go:186`**:
   - *Descripción:* Renombrado de variable ambigua `userIDVal` a `rawUserID` en `GetProfile`.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
9. **`backend-go/internal/service/auth_service.go:204`**:
   - *Descripción:* Renombrado de variable local `p` a `perfilCompleto` en `GetPublicProfile`. Se confirmó que la respuesta `auth.PublicProfileResponse` preserva los 10 campos y su orden original exacto.
   - *Severidad:* Menor.
   - *Acción:* Aprobada.
10. **`backend-go/internal/service/auth_service.go:315`**:
    - *Descripción:* Aclaración de identificadores ambiguos `raw` $\to$ `rawURL` y `u` $\to$ `trimmedURL` en `validateImageURL`.
    - *Severidad:* Menor.
    - *Acción:* Aprobada.
11. **`backend-go/internal/service/auth_service.go:354-392`**:
    - *Descripción:* Aclaración de identificadores abreviados en `updateProfileByUserID` (`tel` $\to$ `telefono`, `hab` $\to$ `habilidades`, `foto` $\to$ `fotoURL`, `portada` $\to$ `portadaURL`) y formato del bloque condicional de asignación de imágenes.
    - *Severidad:* Menor.
    - *Acción:* Aprobada.
12. **Consumidores del interceptor gRPC (`cmd/catalog`, `cmd/chat`, `cmd/orders`, `cmd/iam`):**
    - *Descripción:* Se confirmó que `UserIDKey` ("user_id"), su tipo subyacente `uint` y las rutas públicas/protegidas se mantuvieron inalteradas.
    - *Severidad:* Menor.
    - *Acción:* Aprobada.
13. **Verificación de restricciones del refactor:**
    - No se crearon funciones, métodos, endpoints ni tipos nuevos.
    - No se alteraron archivos `.proto` ni código generado (`*.pb.go`, `*.pb.gw.go`).
    - No se introdujeron paquetes o dependencias externas.

---

## 5. Correcciones aplicadas

**Ninguna.** La revisión integral del diff y la comprobación de equivalencia funcional confirmaron que el refactor no introdujo desviaciones, regresiones ni roturas de contrato con respecto a `fb5fa8a`.

---

## 6. Defectos preexistentes (Lista B de ALL-127) para semanas posteriores

Se ratifican los seis defectos y deudas técnicas preexistentes identificados en `fb5fa8a` y heredados de ALL-127. **NO fueron modificados y se mantienen en estado NO RESUELTO:**

1. **B-01: Triplicación del fallback de clave JWT insegura:** La cadena `"super-secret-key-development-only"` permanece triplicada en `auth_service.go:172`, `jwt_interceptor.go:86` y `jwt_http.go:42`. Estado: **NO RESUELTO**.
2. **B-02: Dependencia de pruebas sobre rama mock de registro y login:** Si `s.db == nil`, `Register` y `Login` asignan estáticamente `IDUsuario = 1` sin autenticación real. Estado: **NO RESUELTO**.
3. **B-03: Disparidad en validación de claims entre HTTP y gRPC:** `jwt_http.go:60` valida `userIDFloat <= 0` rechazando identificadores no positivos, mientras que `jwt_interceptor.go:105` únicamente valida la aserción de tipo a `float64` admitiendo valores `<= 0` antes de convertir a `uint`. Estado: **NO RESUELTO**.
4. **B-04: CORS restringido a localhost:** `cmd/iam/main.go:89` restringe orígenes a `http://localhost:3000` y `http://localhost:3001`, delegando el tráfico productivo al API Gateway/Ingress. Estado: **NO RESUELTO**.
5. **B-05: Regeneración del mapa de rutas públicas por solicitud:** `jwt_interceptor.go:29` instancia el mapa `publicRoutes` en cada invocación unaria en lugar de mantenerlo a nivel de paquete. Estado: **NO RESUELTO**.
6. **B-06: Manejo indiferenciado de errores en la comprobación previa de correo en `Register`:** `auth_service.go:94` evalúa `if err == nil` para retornar `AlreadyExists`, pero cualquier otro error de base de datos se ignora y el flujo continúa directamente hacia el `Create`. Estado: **NO RESUELTO**.

---

## 7. Alcance no verificado y justificación

- **Alcance HTTP:** Las solicitudes con `curl.exe` cubrieron los casos de login y perfiles indicados en la tabla. Las pruebas en navegador quedaron fuera del alcance de esta revisión.
- **Evidencia HTTP de `UpdateProfile`:** Las dos corridas usaron la misma base local. El informe reporta equivalencia, pero queda por adjuntar el estado inicial y final de los campos en cada versión. Para acreditarla, debe quedar registrado un `GET` con textos y URLs de imagen no vacíos antes de cada `PUT` y otro `GET` después, con los textos vacíos y las mismas URLs. Si no se guardaron esas salidas, basta repetir ese caso restaurando los valores iniciales antes de cambiar de versión.

---

## 8. Revisión cruzada

- **Revisor:** ____________________
- **Fecha:** ____________________
- **Enlace a la revisión:** PR #338 (`https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/338`)
- **Observaciones:** Pendiente de registro de revisión formal por parte de los revisores asignados del equipo.

---

## 9. Pasos para reproducir

Comandos exactos ejecutados en Windows PowerShell desde la raíz del monorepo:

```powershell
# 1. Configurar variables de entorno desde PostgreSQL IAM
$env:POSTGRES_PASSWORD_IAM = docker exec postgres_iam printenv POSTGRES_PASSWORD

# 2. Pruebas IAM en árbol DESPUÉS (67f95d3)
Set-Location -LiteralPath "backend-go"
go test -v -count=1 -run "TestAuthService_Register|TestGetProfileByUserID|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUpdateProfileByUserID|TestUpdateProfile_UsaElUsuarioDelContexto" ./internal/service/
go test -c -o ./test_mw.exe ./internal/middleware
.\test_mw.exe -test.v
Remove-Item ./test_mw.exe

# 3. Comprobaciones de compilación y linteo
go build ./cmd/iam/...
go vet ./internal/service/... ./internal/middleware/...
gofmt -l internal/service internal/middleware

# 4. Pruebas IAM en árbol ANTES (fb5fa8a)
Set-Location -LiteralPath "C:\Users\Amaroo\AppData\Local\Temp\all128-antes-b8c8493a5e54428f8cd45d82269903d2\backend-go"
go test -v -count=1 -run "TestAuthService_Register|TestGetProfileByUserID|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUpdateProfileByUserID|TestUpdateProfile_UsaElUsuarioDelContexto|TestUnaryAuthInterceptor" ./internal/service/ ./internal/middleware/
go build ./cmd/iam/...
go vet ./internal/service/... ./internal/middleware/...

# 5. Ejecución HTTP dinámica en ambas versiones
# Configuración del proceso:
$env:DB_HOST = "localhost"
$env:DB_PORT = "5433"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = $env:POSTGRES_PASSWORD_IAM
$env:DB_NAME = "iam_db"
$env:DB_SSLMODE = "disable"
$env:HTTP_PORT = "8085"
$env:GRPC_PORT = "50055"
$env:JWT_SECRET = "test-secret-key-for-verification"

# Iniciar servidor en cada árbol con:
# Start-Process -FilePath "go" -ArgumentList "run", "./cmd/iam" -NoNewWindow
# Y ejecutar peticiones vía curl.exe según los casos detallados en la Sección 3.
```
