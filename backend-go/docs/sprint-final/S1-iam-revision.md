# S1 — Revisión de responsabilidades y dependencias IAM (ALL-127)

> **Fecha:** 2026-11-11
> **Rama:** `chore/127-iam-revision-responsabilidades-dependencias`
> **Baseline:** `develop` en `b3dc9ad`

---

## 1. Inventario de funciones públicas y componentes

### 1.1 `backend-go/internal/service/auth_service.go`

| Función / Símbolo | Archivo:Línea | Entrada | Salida | Llamador | Efecto persistente | Manejo de errores |
|-------------------|---------------|---------|--------|----------|--------------------|-------------------|
| `NewAuthService` | `auth_service.go:45` | `db *gorm.DB` | `*AuthService` | `cmd/iam/main.go:61` | Ninguno (inicializa struct y registra validador custom `password_rn06`) | No propaga errores |
| `Register` | `auth_service.go:55` | `ctx context.Context, req *auth.RegisterRequest` | `(*auth.RegisterResponse, error)` | Servidor gRPC vía `auth.RegisterAuthServiceServer` (`cmd/iam/main.go:62`) | **Create** en tabla `usuarios` (modelo `models.Usuario`) vía GORM. Si `db == nil`, asigna `IDUsuario = 1` en memoria como mock | Propaga `InvalidArgument` (validación struct/RN-06), `Internal` (bcrypt, DB create, JWT). Si la consulta previa de correo encuentra una fila existente, devuelve `AlreadyExists`. Si esa consulta devuelve un error (de cualquier tipo), el flujo continúa igualmente hacia el `Create`, sin distinguir el tipo de error de la consulta previa |
| `Login` | `auth_service.go:121` | `ctx context.Context, req *auth.LoginRequest` | `(*auth.LoginResponse, error)` | Servidor gRPC vía `auth.RegisterAuthServiceServer` (`cmd/iam/main.go:62`) | **Read** en tabla `usuarios` (búsqueda por `correo`). Si `db == nil`, asigna `IDUsuario = 1` como mock | Propaga `InvalidArgument` (validación de email/password vacíos), `Unauthenticated` (usuario no encontrado o hash bcrypt no coincide), `Internal` (error DB de consulta, JWT) |
| `GetProfile` | `auth_service.go:184` | `ctx context.Context, req *auth.ProfileRequest` | `(*auth.ProfileResponse, error)` | Servidor gRPC vía `auth.RegisterAuthServiceServer` (`cmd/iam/main.go:62`) | **Read** en tablas `usuarios` y `perfiles` (delega en `getProfileByUserID`) | Si el valor en contexto está ausente (`nil`), devuelve `Unauthenticated` ("usuario no autenticado"). Si el tipo es incorrecto (no `uint`), devuelve `Internal` ("error interno al leer el ID de usuario"). Para cualquier `uint` válido (incluyendo `uint(0)`), delega a `getProfileByUserID` |
| `GetPublicProfile` | `auth_service.go:200` | `ctx context.Context, req *auth.PublicProfileRequest` | `(*auth.PublicProfileResponse, error)` | Servidor gRPC vía `auth.RegisterAuthServiceServer` (`cmd/iam/main.go:62`) | **Read** en tablas `usuarios` y `perfiles` (delega en `getProfileByUserID`) | Propaga `InvalidArgument` si `user_id <= 0`. Delega el resto a `getProfileByUserID` |
| `UpdateProfile` | `auth_service.go:327` | `ctx context.Context, req *auth.UpdateProfileRequest` | `(*auth.ProfileResponse, error)` | Servidor gRPC vía `auth.RegisterAuthServiceServer` (`cmd/iam/main.go:62`) | **Create o Update** en tabla `perfiles` (delega en `updateProfileByUserID`) | Extrae ID con `userIDFromContext`. Propaga `Unauthenticated` si falta el claim, no es `uint` o es 0. Delega el resto a `updateProfileByUserID` |
| `generateJWT` | `auth_service.go:169` | `userID uint` | `(string, error)` | `Register` (línea 108), `Login` (línea 155) | Ninguno (genera y firma token JWT en memoria con algoritmo HS256) | Propaga error de firma. Silencia la ausencia de la variable de entorno `JWT_SECRET` utilizando fallback inseguro |
| `passwordRuleValid` | `auth_service.go:32` | `fl validator.FieldLevel` | `bool` | Registrado como validador `"password_rn06"` en `NewAuthService` (línea 47) | Ninguno | Retorna `false` si no cumple regla RN-06 (mínimo 8 caracteres, al menos una mayúscula, una minúscula, un dígito y un carácter especial) |
| `defaultAvatarURL` | `auth_service.go:223` | ninguno | `string` | `getProfileByUserID` (línea 254) | Ninguno | Devuelve constante `fallbackAvatarURL` |
| `getProfileByUserID` | `auth_service.go:232` | `idUsuario uint` | `(*auth.ProfileResponse, error)` | `GetProfile` (línea 197), `GetPublicProfile` (línea 204), `updateProfileByUserID` (línea 391) | **Read** en tabla `usuarios` y `perfiles` | Propaga `Internal` si `s.db == nil` o ante error de consulta; `NotFound` si el usuario no existe. Un perfil asociado inexistente (sin fila en tabla `perfiles`, `gorm.ErrRecordNotFound`) **se tolera**: devuelve la respuesta igualmente con valores por defecto y avatar fallback, sin error |
| `userIDFromContext` | `auth_service.go:276` | `ctx context.Context` | `(uint, error)` | Únicamente `UpdateProfile` en producción (línea 328) | Ninguno | Rechaza tanto el tipo incorrecto (`!ok`) como el valor cero (`idUsuario == 0`), retornando `Unauthenticated` ("usuario no autenticado") en ambos casos, a diferencia de `GetProfile` |
| `validateUpdateProfileRequest` | `auth_service.go:285` | `req *auth.UpdateProfileRequest` | `error` | `updateProfileByUserID` (línea 340) | Ninguno | Propaga `InvalidArgument` si teléfono, ciudad, región o URLs superan límites o violan regex |
| `cloudinaryURLPrefix` | `auth_service.go:306` | ninguno | `string` | `validateImageURL` (línea 320) | Ninguno | Retorna prefijo Cloudinary según `CLOUDINARY_CLOUD_NAME` o fallback `"rstk3bky"` |
| `validateImageURL` | `auth_service.go:315` | `campo, raw string` | `error` | `validateUpdateProfileRequest` (líneas 295, 298) | Ninguno | Propaga `InvalidArgument` si la URL excede 500 caracteres o no coincide con prefijo Cloudinary |
| `updateProfileByUserID` | `auth_service.go:336` | `idUsuario uint, req *auth.UpdateProfileRequest` | `(*auth.ProfileResponse, error)` | `UpdateProfile` (línea 333) | **Create o Update** en tabla `perfiles`, **Read** en tabla `usuarios` | Propaga `Internal` (`s.db == nil`, error DB), `NotFound` (usuario no existe), `InvalidArgument` (validación de campos) |

---

### 1.2 `backend-go/internal/middleware/jwt_interceptor.go`

| Función / Símbolo | Archivo:Línea | Entrada | Salida | Responsabilidad |
|-------------------|---------------|---------|--------|-----------------|
| `UnaryAuthInterceptor` | `jwt_interceptor.go:21` | ninguno | `grpc.UnaryServerInterceptor` | Interceptor gRPC unario. Clasifica endpoints en públicos vs protegidos. En **rutas públicas** (`Login`, `Register`, `GetPublicProfile`, `GetCategories`, `GetPublication`, `ListPublications`), si viene token Bearer válido inyecta `UserIDKey`, si no viene o es inválido permite el paso como visitante. En **rutas protegidas**, exige token Bearer válido; de lo contrario aborta con `codes.Unauthenticated` |
| `userIDFromToken` | `jwt_interceptor.go:60` | `ctx context.Context` | `(uint, error)` | Extrae metadata gRPC (`authorization` o `grpcgateway-authorization`). Verifica prefijo `Bearer `. Valida token con cualquier algoritmo de la familia HMAC (`*jwt.SigningMethodHMAC`). Extrae claim `user_id` comprobando únicamente que sea de tipo `float64`, sin validar si es positivo o cero, y lo convierte a `uint`. Emplea `JWT_SECRET` o fallback de desarrollo |

**Consumidores confirmados de `UnaryAuthInterceptor`:**
1. `backend-go/cmd/iam/main.go:59` — Interceptor del servidor gRPC de IAM.
2. `backend-go/cmd/catalog/main.go:63` — Interceptor del servidor gRPC de Catalog.
3. `backend-go/cmd/chat/main.go:57` — Interceptor del servidor gRPC de Chat.

---

### 1.3 `backend-go/internal/middleware/jwt_http.go`

| Función / Símbolo | Archivo:Línea | Entrada | Salida | Responsabilidad |
|-------------------|---------------|---------|--------|-----------------|
| `HTTPAuth` | `jwt_http.go:17` | `next http.Handler` | `http.Handler` | Middleware HTTP estándar. Exige header `Authorization: Bearer <token>`. Inyecta `user_id` en `r.Context()` bajo `middleware.UserIDKey`. Si falla, responde HTTP 401 JSON |
| `userIDFromHTTP` | `jwt_http.go:30` | `r *http.Request` | `(uint, error)` | Extrae header HTTP `Authorization`. Parsea JWT aceptando cualquier método de la familia HMAC (`*jwt.SigningMethodHMAC`). Extrae claim `user_id` como `float64` y **rechaza explícitamente valores menores o iguales a cero (`userIDFloat <= 0`) antes de convertir**. Emplea `JWT_SECRET` o fallback de desarrollo |

**Consumidores confirmados de `HTTPAuth`:**
- `backend-go/cmd/media/main.go:39` — Protege endpoints HTTP de carga de imágenes a Cloudinary.

---

### 1.4 `backend-go/cmd/iam/main.go` — Flujo de inicialización

| Paso | Líneas | Operación / Componente | Descripción |
|------|--------|------------------------|-------------|
| 1 | 27-31 | `database.ConnectDB()` | Conexión con PostgreSQL vía GORM. Si falla, aborta el proceso con `log.Fatalf` |
| 2 | 34-39 | `db.AutoMigrate(...)` | Migración de esquemas de tablas `Usuario` y `Perfil`. Si falla, aborta con `log.Fatalf` |
| 3 | 42-49 | Lectura de entorno | Obtiene `GRPC_PORT` (default `:50051`) y `HTTP_PORT` (default `:8080`) |
| 4 | 52-56 | `net.Listen(...)` | Abre socket TCP en el puerto gRPC indicado |
| 5 | 58-63 | Servidor gRPC | Instancia `grpc.NewServer` registrando `middleware.UnaryAuthInterceptor()`. Registra `auth.RegisterAuthServiceServer(grpcServer, service.NewAuthService(db))` y habilita reflection |
| 6 | 66-71 | Goroutine gRPC | Inicia `grpcServer.Serve(listener)` en segundo plano |
| 7 | 74-85 | gRPC-Gateway | Crea mux HTTP de `grpc-gateway` y registra handler de `AuthService` apuntando al endpoint gRPC local |
| 8 | 88-93 | Configuración CORS | Aplica wrapper `cors.New` configurando `AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"}` |
| 9 | 97-100 | Servidor HTTP | Inicia `http.ListenAndServe` en el puerto HTTP |

---

## 2. Verificación cruzada con Deuda Técnica (Sección 12 de PROJECT_CONTEXT.md)

### 2a. "Fallback JWT inseguro"
- **Estado verificado en código:** ⚠️ **SIGUE VIGENTE**.
- El string hardcodeado `"super-secret-key-development-only"` permanece presente en tres puntos del código:
  1. `backend-go/internal/service/auth_service.go:172`
  2. `backend-go/internal/middleware/jwt_interceptor.go:86`
  3. `backend-go/internal/middleware/jwt_http.go:42`
- Si la variable de entorno `JWT_SECRET` está vacía, el sistema recurre de forma silenciosa a esta clave compartida sin emitir advertencia en logs ni detener la aplicación.

### 2b. "Login y GetProfile devuelven datos mock"
- **Estado verificado en código:** ⚠️ **RESUELTO EN RUTA DE PRODUCCIÓN; RAMAS SIN DB IDENTIFICADAS**.
- En condiciones normales de ejecución (`main.go` con base de datos conectada):
  - `Login` (`auth_service.go:137-158`) busca el usuario real en PostgreSQL por correo, compara el hash con `bcrypt.CompareHashAndPassword` y genera un JWT con el `IDUsuario` persistido.
  - `GetProfile` (`auth_service.go:184-198` y `232-271`) lee las entidades `Usuario` y `Perfil` desde PostgreSQL vía GORM mediante el ID inyectado en el contexto por el interceptor JWT.
- En condiciones sin base de datos (`s.db == nil`):
  - `Register` (`auth_service.go:104`) asigna `IDUsuario = 1` en memoria sin persistir.
  - `Login` (`auth_service.go:151`) asigna `IDUsuario = 1` sin consultar ni verificar credenciales contra ninguna fuente de datos.
  - `GetProfile` (`auth_service.go:233-235`) devuelve error `codes.Internal` ("conexión a base de datos no disponible").

### 2c. "CORS del Go sigue con localhost"
- **Estado verificado en código:** ⚠️ **SIGUE VIGENTE**.
- En `backend-go/cmd/iam/main.go:89`, la configuración de orígenes permitidos se encuentra restringida a:
  ```go
  AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"},
  ```
- En el clúster de Kubernetes, el tráfico externo es filtrado y provisto de headers CORS por el Nginx Ingress / API Gateway para el dominio `marketplace-aalarcon.dev.censei.cl`. Si las peticiones ingresaran directamente al microservicio Go sin pasar por dicho gateway, fallarían por política de origen.

---

## 3. Hallazgos de refactor

### 3.1 H-01: Extracción de `user_id` del contexto en `GetProfile` vs `userIDFromContext` (DETECTADO Y DESCARTADO)

- **Ubicación:** `backend-go/internal/service/auth_service.go:184-198` vs `276-283`.
- **Análisis de comportamiento:** Inicialmente se evaluó sustituir el bloque manual de extracción de `user_id` en `GetProfile` por el helper `userIDFromContext(ctx)` (utilizado por `UpdateProfile`). Sin embargo, una inspección rigurosa reveló **dos diferencias de comportamiento observables**:
  1. **Tipo incorrecto en el contexto:** Ante un valor presente en `ctx.Value(middleware.UserIDKey)` cuyo tipo subyacente no es `uint` (por ejemplo, un `string` o `int`), `GetProfile` original ejecuta:
     ```go
     idUsuario, ok := userIDVal.(uint)
     if !ok {
         return nil, status.Errorf(codes.Internal, "error interno al leer el ID de usuario")
     }
     ```
     retornando `codes.Internal`. En contraste, `userIDFromContext` ejecuta:
     ```go
     idUsuario, ok := userIDVal.(uint)
     if !ok {
         return 0, status.Errorf(codes.Unauthenticated, "usuario no autenticado")
     }
     ```
     retornando `codes.Unauthenticated`.
  2. **Tratamiento del valor cero (`uint(0)`):** Si el contexto contiene `uint(0)`, `GetProfile` original valida la aserción de tipo exitosamente (`ok == true`) y avanza hacia `getProfileByUserID(0)`. En contraste, `userIDFromContext` contiene una guarda explícita:
     ```go
     if idUsuario == 0 {
         return 0, status.Errorf(codes.Unauthenticated, "usuario no autenticado")
     }
     ```
     rechazando el valor y retornando `codes.Unauthenticated` sin invocar la capa de persistencia.
- **Decisión:** En estricto apego al límite no negociable de ALL-127 (prohibición total de cambios de comportamiento visible o contratos), **se descartó la unificación H-01**. `GetProfile` conserva su implementación original de `b3dc9ad`, y `userIDFromContext` mantiene como único llamador en producción a `UpdateProfile`.

### 3.2 H-02: Fallback JWT triplicado (DESCARTADO PARA ESTA SEMANA → Lista B)
- **Ubicación:** `auth_service.go:170-173`, `jwt_interceptor.go:84-87`, `jwt_http.go:40-43`.
- **Análisis:** La lectura de `os.Getenv("JWT_SECRET")` y asignación de la clave por defecto se repite en tres componentes. Unificarlo exigiría definir una función pública o helper compartido (por ejemplo `middleware.JWTSecret()`), lo cual está prohibido bajo las restricciones de la tarea. Se clasifica en la Lista B (B-01).

### 3.3 H-03: Validación JWT entre gRPC y HTTP (DESCARTADO PARA ESTA SEMANA → Lista B)
- **Ubicación:** `jwt_interceptor.go:60-111` y `jwt_http.go:30-64`.
- **Análisis de divergencia en la lógica:**
  1. `generateJWT` firma explícitamente con `jwt.SigningMethodHS256` (`auth_service.go:175`).
  2. Tanto `jwt_interceptor.go:90` como `jwt_http.go:46` aceptan cualquier algoritmo de la familia HMAC (`*jwt.SigningMethodHMAC`, permitiendo HS256, HS384 y HS512).
  3. La duplicación **no es idéntica**: `jwt_http.go:60` valida `if !ok || userIDFloat <= 0`, rechazando identificadores no positivos antes de la conversión a `uint`. En cambio, `jwt_interceptor.go:106` únicamente evalúa `if !ok`, admitiendo valores flotantes `<= 0` en el chequeo de tipo y convirtiéndolos ciegamente a `uint`.
  4. Extraer una rutina común requiere introducir nuevas funciones y armonizar semánticas de validación. Se clasifica en la Lista B (B-03).

### 3.4 H-04: Comentario equívoco sobre el fallback de desarrollo (APLICADO ✅ → Lista A)
- **Ubicación:** `backend-go/internal/service/auth_service.go:172`.
- **Análisis:** El comentario de línea original rezaba `// Fallback seguro para desarrollo`. Al tratarse de un secreto público en el repositorio, la afirmación de seguridad es técnicamente falsa y engañosa. Se actualizó el comentario a:
  ```go
  secretKey = "super-secret-key-development-only" // TODO: fallback INSEGURO, solo para desarrollo local
  ```
  No altera ninguna instrucción ejecutable ni comportamiento en runtime.

### 3.5 H-05: Ramas condicionales sin base de datos en Register y Login (DESCARTADO PARA ESTA SEMANA → Lista B)
- **Ubicación:** `auth_service.go:91-105` y `auth_service.go:137-152`.
- **Análisis de consumidores de prueba:**
  - En `auth_service_test.go`, existen tres pruebas unitarias que inicializan el servicio con `NewAuthService(nil)`:
    1. `TestAuthService_Register_Valid`: es la **única prueba** que completa la validación de entrada y ejecuta efectivamente la rama mock (`s.db == nil`), asignando `IDUsuario = 1` y emitiendo un token.
    2. `TestAuthService_Register_InvalidEmail`: falla en la validación de formato (`s.validate.Struct(input)` en línea 69) y retorna `codes.InvalidArgument` antes de evaluar `s.db`.
    3. `TestAuthService_Register_ShortPassword`: falla en la regla de contraseña RN-06 en línea 69 y retorna `codes.InvalidArgument` antes de evaluar `s.db`.
  - Remover la rama mock en Register rompería `TestAuthService_Register_Valid` a menos que se introduzca un mock estructurado de GORM (`sqlmock`). Modificar la suite de pruebas o eliminar la rama excede el alcance de ALL-127. Se clasifica en la Lista B (B-02).

### 3.6 H-06: Manejo de errores en consulta de correo previo en Register (DESCARTADO PARA ESTA SEMANA → Lista B)
- **Ubicación:** `backend-go/internal/service/auth_service.go:94-96`.
- **Análisis:** En `Register`:
  ```go
  var check models.Usuario
  if err := s.db.Where("correo = ?", req.GetEmail()).First(&check).Error; err == nil {
      return nil, status.Errorf(codes.AlreadyExists, "el correo ya está registrado")
  }
  ```
  Si la consulta encuentra un registro (`err == nil`), rechaza con `AlreadyExists`. No obstante, ante cualquier error retornado por la consulta (sea `gorm.ErrRecordNotFound`, fallo de conectividad de red o indisponibilidad transitoria del socket), el flujo continúa de forma indiferenciada hacia la instrucción `s.db.Create(&nuevoUsuario)`. Se clasifica en la Lista B (B-06) para revisión posterior.

---

## 4. Clasificación

### Lista A — Refactors aplicados

| ID | Modificación | Archivo:Línea | Verificación / Impacto |
|----|--------------|---------------|-------------------------|
| A-02 | Corrección de comentario documental: `// Fallback seguro para desarrollo` → `// TODO: fallback INSEGURO, solo para desarrollo local` | `backend-go/internal/service/auth_service.go:172` | Verificado con `git diff`. No modifica bytecode, flujo de ejecución ni semántica visible. Compilación limpia (`go build ./...`). |

*(Nota: El ítem A-01 propuesto en fases preliminares fue revertido y descartado formalmente tras constatar discrepancias semánticas en el manejo de tipos y valores nulos).*

### Lista B — Defectos y pendientes registrados (NO tocar esta semana)

| ID | Hallazgo / Defecto | Archivo(s) | Justificación para diferir |
|----|--------------------|------------|----------------------------|
| B-01 | Fallback de clave secreta JWT hardcodeada triplicado | `auth_service.go:172`, `jwt_interceptor.go:86`, `jwt_http.go:42` | Requiere definir política de seguridad (panic vs fatal vs flag) y consolidar en helper compartido (creación de nueva función prohibida en ALL-127). |
| B-02 | Ramas de mock en memoria (`s.db == nil`) en Register y Login | `auth_service.go:104`, `auth_service.go:151` | `TestAuthService_Register_Valid` depende de la rama sin DB. Eliminarla exige refactorizar pruebas hacia mocks de base de datos (`sqlmock`). |
| B-03 | Disparidad de validación en claims JWT entre gRPC y HTTP | `jwt_interceptor.go:106`, `jwt_http.go:60` | HTTP rechaza identificadores `<= 0` mientras gRPC no valida rango numérico; unificar validadores alteraría el contrato de transporte actual. |
| B-04 | Restricción de CORS a orígenes localhost en el binario Go | `cmd/iam/main.go:89` | Mitigado por la capa Nginx Ingress en Kubernetes. Su parametrización requiere introducir variables de entorno adicionales. |
| B-05 | Regeneración del mapa de rutas públicas en cada request gRPC | `jwt_interceptor.go:29-36` | Optimización menor; trasladarlo a ámbito de paquete implicaría crear una variable global nueva. |
| B-06 | Tolerancia indiscriminada de errores en chequeo previo de correo de Register | `auth_service.go:94` | Alterar la verificación de `err` en la consulta previa para discriminar `ErrRecordNotFound` de fallos de conexión modifica la semántica de error del endpoint. |

---

## 5. Evidencia de compilación y pruebas

### 5.1 Compilación y pruebas filtradas: Comparación Baseline vs Diff Final

#### (a) Ejecución sobre Baseline (`b3dc9ad`)

**Comando de compilación:**
```bash
cd backend-go && go build ./...
echo "EXIT_CODE:$LastExitCode"
```
**Salida de compilación:**
```
EXIT_CODE:0
```

**Comando de pruebas filtradas:**
```bash
cd backend-go && go test ./internal/service/... ./internal/middleware/... -v -count=1 -run "TestAuthService_Register|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUnaryAuthInterceptor|TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario"
echo "EXIT_CODE:$LastExitCode"
```
**Salida de pruebas:**
```
=== RUN   TestAuthService_Register_Valid
--- PASS: TestAuthService_Register_Valid (0.05s)
=== RUN   TestAuthService_Register_InvalidEmail
--- PASS: TestAuthService_Register_InvalidEmail (0.00s)
=== RUN   TestAuthService_Register_ShortPassword
--- PASS: TestAuthService_Register_ShortPassword (0.00s)
=== RUN   TestUserIDFromContext
=== RUN   TestUserIDFromContext/devuelve_el_ID_inyectado_por_el_interceptor
=== RUN   TestUserIDFromContext/sin_ID_en_el_contexto_retorna_Unauthenticated
--- PASS: TestUserIDFromContext (0.00s)
    --- PASS: TestUserIDFromContext/devuelve_el_ID_inyectado_por_el_interceptor (0.00s)
    --- PASS: TestUserIDFromContext/sin_ID_en_el_contexto_retorna_Unauthenticated (0.00s)
=== RUN   TestValidateUpdateProfileRequest
=== RUN   TestValidateUpdateProfileRequest/request_vacio_es_valido
=== RUN   TestValidateUpdateProfileRequest/telefono_con_formato_internacional
=== RUN   TestValidateUpdateProfileRequest/telefono_con_letras
=== RUN   TestValidateUpdateProfileRequest/telefono_demasiado_corto
=== RUN   TestValidateUpdateProfileRequest/telefono_demasiado_largo
=== RUN   TestValidateUpdateProfileRequest/ciudad_de_100_caracteres_es_valida
=== RUN   TestValidateUpdateProfileRequest/ciudad_de_101_caracteres_es_invalida
=== RUN   TestValidateUpdateProfileRequest/region_de_101_caracteres_es_invalida
--- PASS: TestValidateUpdateProfileRequest (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/request_vacio_es_valido (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_con_formato_internacional (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_con_letras (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_demasiado_corto (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_demasiado_largo (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/ciudad_de_100_caracteres_es_valida (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/ciudad_de_101_caracteres_es_invalida (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/region_de_101_caracteres_es_invalida (0.00s)
=== RUN   TestUpdateProfile_UsaElUsuarioDelContexto
=== RUN   TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario_en_el_contexto_retorna_Unauthenticated
--- PASS: TestUpdateProfile_UsaElUsuarioDelContexto (0.00s)
    --- PASS: TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario_en_el_contexto_retorna_Unauthenticated (0.00s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service	0.383s
testing: warning: no tests to run
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media	0.372s [no tests to run]
=== RUN   TestUnaryAuthInterceptor_RutasPublicas
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/con_Bearer_valido_inyecta_UserIDKey
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/sin_token_sigue_siendo_publica_y_no_inyecta
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/sin_metadata_sigue_siendo_publica
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/token_invalido_se_trata_como_visitante,_sin_error
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/token_expirado_se_trata_como_visitante,_sin_error
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/firmado_con_otra_clave_se_trata_como_visitante
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/formato_distinto_de_Bearer_se_trata_como_visitante
--- PASS: TestUnaryAuthInterceptor_RutasPublicas (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/con_Bearer_valido_inyecta_UserIDKey (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/sin_token_sigue_siendo_publica_y_no_inyecta (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/sin_metadata_sigue_siendo_publica (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/token_invalido_se_trata_como_visitante,_sin_error (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/token_expirado_se_trata_como_visitante,_sin_error (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/firmado_con_otra_clave_se_trata_como_visitante (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/formato_distinto_de_Bearer_se_trata_como_visitante (0.00s)
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/con_Bearer_valido_inyecta_UserIDKey
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_metadata
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_header
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_formato_invalido
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_token_basura
--- PASS: TestUnaryAuthInterceptor_RutasProtegidas (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/con_Bearer_valido_inyecta_UserIDKey (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_metadata (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_header (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_formato_invalido (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_token_basura (0.00s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware	0.246s
EXIT_CODE:0
```

#### (b) Ejecución sobre Diff Final Corregido

**Comando de compilación:**
```bash
cd backend-go && go build ./...
echo "EXIT_CODE:$LastExitCode"
```
**Salida de compilación:**
```
EXIT_CODE:0
```

**Comando de pruebas filtradas:**
```bash
cd backend-go && go test ./internal/service/... ./internal/middleware/... -v -count=1 -run "TestAuthService_Register|TestUserIDFromContext|TestValidateUpdateProfileRequest|TestUnaryAuthInterceptor|TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario"
echo "EXIT_CODE:$LastExitCode"
```
**Salida de pruebas:**
```
=== RUN   TestAuthService_Register_Valid
--- PASS: TestAuthService_Register_Valid (0.05s)
=== RUN   TestAuthService_Register_InvalidEmail
--- PASS: TestAuthService_Register_InvalidEmail (0.00s)
=== RUN   TestAuthService_Register_ShortPassword
--- PASS: TestAuthService_Register_ShortPassword (0.00s)
=== RUN   TestUserIDFromContext
=== RUN   TestUserIDFromContext/devuelve_el_ID_inyectado_por_el_interceptor
=== RUN   TestUserIDFromContext/sin_ID_en_el_contexto_retorna_Unauthenticated
--- PASS: TestUserIDFromContext (0.00s)
    --- PASS: TestUserIDFromContext/devuelve_el_ID_inyectado_por_el_interceptor (0.00s)
    --- PASS: TestUserIDFromContext/sin_ID_en_el_contexto_retorna_Unauthenticated (0.00s)
=== RUN   TestValidateUpdateProfileRequest
=== RUN   TestValidateUpdateProfileRequest/request_vacio_es_valido
=== RUN   TestValidateUpdateProfileRequest/telefono_con_formato_internacional
=== RUN   TestValidateUpdateProfileRequest/telefono_con_letras
=== RUN   TestValidateUpdateProfileRequest/telefono_demasiado_corto
=== RUN   TestValidateUpdateProfileRequest/telefono_demasiado_largo
=== RUN   TestValidateUpdateProfileRequest/ciudad_de_100_caracteres_es_valida
=== RUN   TestValidateUpdateProfileRequest/ciudad_de_101_caracteres_es_invalida
=== RUN   TestValidateUpdateProfileRequest/region_de_101_caracteres_es_invalida
--- PASS: TestValidateUpdateProfileRequest (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/request_vacio_es_valido (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_con_formato_internacional (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_con_letras (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_demasiado_corto (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/telefono_demasiado_largo (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/ciudad_de_100_caracteres_es_valida (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/ciudad_de_101_caracteres_es_invalida (0.00s)
    --- PASS: TestValidateUpdateProfileRequest/region_de_101_caracteres_es_invalida (0.00s)
=== RUN   TestUpdateProfile_UsaElUsuarioDelContexto
=== RUN   TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario_en_el_contexto_retorna_Unauthenticated
--- PASS: TestUpdateProfile_UsaElUsuarioDelContexto (0.00s)
    --- PASS: TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario_en_el_contexto_retorna_Unauthenticated (0.00s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service	0.359s
testing: warning: no tests to run
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media	0.402s [no tests to run]
=== RUN   TestUnaryAuthInterceptor_RutasPublicas
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/con_Bearer_valido_inyecta_UserIDKey
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/sin_token_sigue_siendo_publica_y_no_inyecta
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/sin_metadata_sigue_siendo_publica
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/token_invalido_se_trata_como_visitante,_sin_error
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/token_expirado_se_trata_como_visitante,_sin_error
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/firmado_con_otra_clave_se_trata_como_visitante
=== RUN   TestUnaryAuthInterceptor_RutasPublicas/formato_distinto_de_Bearer_se_trata_como_visitante
--- PASS: TestUnaryAuthInterceptor_RutasPublicas (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/con_Bearer_valido_inyecta_UserIDKey (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/sin_token_sigue_siendo_publica_y_no_inyecta (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/sin_metadata_sigue_siendo_publica (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/token_invalido_se_trata_como_visitante,_sin_error (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/token_expirado_se_trata_como_visitante,_sin_error (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/firmado_con_otra_clave_se_trata_como_visitante (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasPublicas/formato_distinto_de_Bearer_se_trata_como_visitante (0.00s)
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/con_Bearer_valido_inyecta_UserIDKey
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_metadata
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_header
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_formato_invalido
=== RUN   TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_token_basura
--- PASS: TestUnaryAuthInterceptor_RutasProtegidas (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/con_Bearer_valido_inyecta_UserIDKey (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_metadata (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_sin_header (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_formato_invalido (0.00s)
    --- PASS: TestUnaryAuthInterceptor_RutasProtegidas/rechaza:_token_basura (0.00s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware	0.229s
EXIT_CODE:0
```

---

### 5.2 Comprobación directa del comportamiento de `GetProfile`

Para validar empíricamente la conducta de `GetProfile` bajo la implementación original restablecida frente a casos no cubiertos por las pruebas unitarias existentes de `userIDFromContext`, se evaluaron los cuatro escenarios de contexto:

| Escenario | Contexto inyectado | Código gRPC retornado | Mensaje retornado | Comportamiento observado |
|-----------|--------------------|-----------------------|-------------------|--------------------------|
| **(a) Clave ausente** | `context.Background()` | `codes.Unauthenticated` (16) | `"usuario no autenticado"` | `userIDVal == nil` activa la guarda inicial; **no requiere DB** |
| **(b) Tipo incorrecto** | `context.WithValue(..., UserIDKey, "invalido")` | `codes.Internal` (13) | `"error interno al leer el ID de usuario"` | La aserción `.(uint)` falla (`ok == false`), retornando `Internal` (a diferencia de `userIDFromContext` que retorna `Unauthenticated`); **no requiere DB** |
| **(c) Valor cero** | `context.WithValue(..., UserIDKey, uint(0))` | `codes.NotFound` (5) *(con DB)* / `codes.Internal` (13) *(sin DB)* | `"usuario no encontrado"` *(con DB)* / `"conexión a base de datos no disponible"` *(sin DB)* | `GetProfile` **no rechaza el valor 0** en el contexto y avanza hacia `getProfileByUserID(0)`. Con base de datos activa busca la fila ID 0 en PostgreSQL y retorna `NotFound` (verificada con prueba ad-hoc inline abajo); sin DB falla con `Internal` |
| **(d) Identificador válido** | `context.WithValue(..., UserIDKey, uint(idValido))` | `codes.OK` (0) *(con DB)* / `codes.Internal` (13) *(sin DB)* | Respuesta de perfil válida *(con DB)* / `"conexión a base de datos no disponible"` *(sin DB)* | La aserción de tipo es exitosa y delega a `getProfileByUserID`. Con base de datos activa recupera los datos completos del usuario y su perfil; sin DB retorna `Internal` |

#### Evidencia empírica puntual del caso (c) `GetProfile` con `uint(0)` directo contra PostgreSQL

Para no asumir el resultado del caso (c), se ejecutó una verificación puntual ad-hoc (mediante un subtest temporal revertido inmediatamente de `auth_service_test.go` para preservar intacto el código del repositorio) que invocó `srv.GetProfile(ctx, &auth.ProfileRequest{})` directamente con `UserIDKey = uint(0)` sobre la base de datos `postgres_iam`.

**Salida cruda capturada:**
```
=== RUN   TestGetProfileByUserID
=== RUN   TestGetProfileByUserID/GetProfile_con_contexto_uint(0)_directo_retorna_codes.NotFound

2026/11/11 01:43:56 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:239 record not found
[2.552ms] [rows:0] SELECT * FROM "usuarios" WHERE "usuarios"."id_usuario" = 0 ORDER BY "usuarios"."id_usuario" LIMIT 1
    auth_service_test.go:189: OUTPUT_TEST_AD_HOC: Code=NotFound (5), Msg="usuario no encontrado"
--- PASS: TestGetProfileByUserID (0.21s)
    --- PASS: TestGetProfileByUserID/GetProfile_con_contexto_uint(0)_directo_retorna_codes.NotFound (0.21s)
PASS
```

Esto confirma con certeza absoluta que `GetProfile` con `uint(0)` no aborta en capa de contexto, sino que consulta la fila `id_usuario = 0` en PostgreSQL y retorna `codes.NotFound` (5).

---

### 5.3 Cobertura contra PostgreSQL: `TestGetProfileByUserID` y persistencia

Para validar la persistencia e integración con PostgreSQL, se levantó el contenedor de base de datos de IAM con `docker compose up -d postgres_iam`, verificando estado saludable en el puerto host 5433 (`0.0.0.0:5433->5432/tcp`).

#### (a) Ejecución exitosa de `TestGetProfile`

Con la variable `POSTGRES_PASSWORD_IAM` cargada desde el archivo `.env` local del monorepo (no se expone el valor en este documento por buenas prácticas de seguridad), se ejecutó la suite de pruebas contra PostgreSQL:

**Comando ejecutado:**
```bash
POSTGRES_PASSWORD_IAM="$env:POSTGRES_PASSWORD_IAM" go test ./internal/service/... -run TestGetProfile -v -count=1
```

**Salida completa (código de salida: 0):**
```
=== RUN   TestGetProfileByUserID
=== RUN   TestGetProfileByUserID/usuario_con_perfil_completo_devuelve_todos_los_campos
=== RUN   TestGetProfileByUserID/usuario_sin_perfil_devuelve_datos_de_usuario_con_campos_de_perfil_vacios

2026/11/11 01:34:07 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:248 record not found
[1.507ms] [rows:0] SELECT * FROM "perfiles" WHERE id_usuario = 20 ORDER BY "perfiles"."id_perfil" LIMIT 1
=== RUN   TestGetProfileByUserID/usuario_inexistente_retorna_codes.NotFound

2026/11/11 01:34:07 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:239 record not found
[2.324ms] [rows:0] SELECT * FROM "usuarios" WHERE "usuarios"."id_usuario" = 999999 ORDER BY "usuarios"."id_usuario" LIMIT 1
--- PASS: TestGetProfileByUserID (0.55s)
    --- PASS: TestGetProfileByUserID/usuario_con_perfil_completo_devuelve_todos_los_campos (0.19s)
    --- PASS: TestGetProfileByUserID/usuario_sin_perfil_devuelve_datos_de_usuario_con_campos_de_perfil_vacios (0.19s)
    --- PASS: TestGetProfileByUserID/usuario_inexistente_retorna_codes.NotFound (0.17s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service	0.860s
testing: warning: no tests to run
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media	0.383s [no tests to run]
```

**Resultado:** Los 3 subtests de `TestGetProfileByUserID` concluyeron en **PASS**, confirmando que:
1. Con usuario y perfil existentes, se retornan todos los campos persistidos.
2. Con usuario existente pero sin perfil, se toleran los campos vacíos y se inyecta el avatar por defecto.
3. Con usuario inexistente, se retorna `codes.NotFound`.

#### (b) Ejecución de `TestUpdateProfileByUserID` contra PostgreSQL real

Para validar la persistencia completa de actualización de perfiles en PostgreSQL, se ejecutó:

**Comando ejecutado:**
```bash
POSTGRES_PASSWORD_IAM="$env:POSTGRES_PASSWORD_IAM" go test ./internal/service/... -run TestUpdateProfileByUserID -v -count=1
```

**Salida completa (código de salida: 0):**
```
=== RUN   TestUpdateProfileByUserID
=== RUN   TestUpdateProfileByUserID/actualiza_un_perfil_existente
=== RUN   TestUpdateProfileByUserID/crea_el_perfil_si_el_usuario_aun_no_tiene_uno

2026/11/11 01:43:34 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:363 record not found
[1.453ms] [rows:0] SELECT * FROM "perfiles" WHERE id_usuario = 25 ORDER BY "perfiles"."id_perfil" LIMIT 1
=== RUN   TestUpdateProfileByUserID/campos_vacios_reemplazan_los_valores_guardados
=== RUN   TestUpdateProfileByUserID/recorta_espacios_en_blanco_al_inicio_y_al_final

2026/11/11 01:43:34 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:363 record not found
[1.477ms] [rows:0] SELECT * FROM "perfiles" WHERE id_usuario = 27 ORDER BY "perfiles"."id_perfil" LIMIT 1
=== RUN   TestUpdateProfileByUserID/usuario_inexistente_retorna_NotFound

2026/11/11 01:43:34 C:/Users/Amaroo/Desktop/Universidad/3er año/2do semestre/Integra 3/Allin1_Taller_de_integracion_III/backend-go/internal/service/auth_service.go:346 record not found
[2.803ms] [rows:0] SELECT * FROM "usuarios" WHERE "usuarios"."id_usuario" = 999999 ORDER BY "usuarios"."id_usuario" LIMIT 1
=== RUN   TestUpdateProfileByUserID/datos_invalidos_retornan_InvalidArgument_y_no_modifican_el_perfil
=== RUN   TestUpdateProfileByUserID/sin_conexion_a_base_de_datos_retorna_Internal
--- PASS: TestUpdateProfileByUserID (1.10s)
    --- PASS: TestUpdateProfileByUserID/actualiza_un_perfil_existente (0.21s)
    --- PASS: TestUpdateProfileByUserID/crea_el_perfil_si_el_usuario_aun_no_tiene_uno (0.21s)
    --- PASS: TestUpdateProfileByUserID/campos_vacios_reemplazan_los_valores_guardados (0.18s)
    --- PASS: TestUpdateProfileByUserID/recorta_espacios_en_blanco_al_inicio_y_al_final (0.17s)
    --- PASS: TestUpdateProfileByUserID/usuario_inexistente_retorna_NotFound (0.17s)
    --- PASS: TestUpdateProfileByUserID/datos_invalidos_retornan_InvalidArgument_y_no_modifican_el_perfil (0.16s)
    --- PASS: TestUpdateProfileByUserID/sin_conexion_a_base_de_datos_retorna_Internal (0.00s)
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service	1.413s
testing: warning: no tests to run
PASS
ok  	github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service/media	0.437s [no tests to run]
```

**Resultado:** Los 7 subtests de `TestUpdateProfileByUserID` concluyeron en **PASS**, cubriendo actualización de perfiles existentes, creación ante inexistencia, reemplazo de campos vacíos, recorte de espacios, usuario inexistente (`NotFound`), validación de campos inválidos (`InvalidArgument`) y manejo de error sin DB (`Internal`).

#### (c) Diagnóstico de conectividad documental (en ausencia de credenciales de entorno)

Si el comando se ejecuta sin exportar `POSTGRES_PASSWORD_IAM`, el arnés de prueba (`setupIamTestDB` en `auth_service_test.go:71-76`) asume la contraseña predeterminada `"postgres"`, fallando con error de autenticación SASL:
```
[error] failed to initialize database, got error failed to connect to `user=postgres database=iam_db`: [::1]:5433 (localhost): failed SASL auth: FATAL: password authentication failed for user "postgres" (SQLSTATE 28P01)
¿está levantado docker-compose up -d postgres_iam?
```
Este error se documenta como evidencia de que la no ejecución en entornos desprovistos de variables de entorno obedece a falta de conexión o credenciales del contenedor local, y no a un defecto de implementación en el código del servicio.

#### (d) Persistencia en Register

Se aclara explícitamente que la prueba unitaria `TestAuthService_Register_Valid` inicializa el servicio con `NewAuthService(nil)`. Por lo tanto, dicha prueba ejecuta la rama condicional `s.db == nil` (asignando `IDUsuario = 1` en memoria) y **tampoco valida la escritura física real en PostgreSQL para Register**.

---

## 6. Matriz de comportamientos y estado de verificación

| Componente / Endpoint | Comportamiento esperado | Estado de verificación | Evidencia técnica |
|-----------------------|-------------------------|------------------------|-------------------|
| **Register** | Valida contrato y RN-06; hashea contraseña con bcrypt; persiste en tabla `usuarios` o emula ID=1 si db=nil; emite JWT HS256 | Validado en capa unitaria (sin persistencia real DB) | `TestAuthService_Register_Valid` PASS, `TestAuthService_Register_InvalidEmail` PASS, `TestAuthService_Register_ShortPassword` PASS. |
| **Login** | Valida request; consulta usuario por correo; valida hash bcrypt; genera JWT | **Revisado por inspección de código** | Sin prueba automatizada end-to-end en la suite unitaria; flujo confirmado mediante análisis estático de líneas 121-167. |
| **GetProfile** | Extrae claim del contexto; maneja tipos y nulos; consulta usuario y perfil tolerando ausencia de perfil | Validado contra PostgreSQL real e inspección de contextos | `TestGetProfileByUserID` (3 sub-tests PASS con contenedor `postgres_iam`) (§5.3(a)) y simulación de los 4 escenarios de contexto con verificación ad-hoc de uint(0) (§5.2). |
| **UpdateProfile** | Extrae claim con `userIDFromContext`; valida campos de contacto/redes; realiza upsert en tabla `perfiles` | Validado en capa unitaria y contra DB real | `TestUserIDFromContext` PASS, `TestValidateUpdateProfileRequest` PASS (8 sub-tests), `TestUpdateProfile_UsaElUsuarioDelContexto/sin_usuario` PASS, `TestUpdateProfileByUserID` PASS (7 sub-tests contra PostgreSQL real) (§5.3(b)). |
| **Interceptor gRPC** | Diferencia rutas públicas (auth opcional) de protegidas (Bearer obligatorio); inyecta `UserIDKey` | Validado integralmente en capa de middleware | `TestUnaryAuthInterceptor_RutasPublicas` (7 sub-tests) PASS, `TestUnaryAuthInterceptor_RutasProtegidas` (5 sub-tests) PASS. |
