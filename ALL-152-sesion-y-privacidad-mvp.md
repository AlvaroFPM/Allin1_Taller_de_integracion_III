# ALL-152 — Sesión y privacidad en los recorridos del MVP

- [Ticket de implementación](https://linear.app/allin1/issue/ALL-152) y [validación del frontend en ALL-182](https://linear.app/allin1/issue/ALL-182).
- Ejecución local del 22 de noviembre de 2026 en `qa/ALL-152-iam-sesion-y-privacidad`, commit `7e44a81`.
- La base probada incluye el merge `f582777` del [PR #349 (ALL-180)](https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/349).
- Windows amd64, Go 1.27.1 y PostgreSQL 16.11 temporal. Se compilaron IAM y Orders y se probaron sus rutas HTTP locales con sus servidores reales. Se crearon dos cuentas de prueba mediante IAM y se insertó una orden temporal con A como comprador y B como vendedor.

## Resultados de la ejecución

| Caso | Resultado esperado y observado |
| --- | --- |
| Registros, login y perfil privado con cambio A → B → A | HTTP 200. Cada sesión devolvió su propio ID, correo, teléfono y ciudad. |
| Compras y ventas con cambio A → B → A | HTTP 200. A vio una compra y cero ventas. B vio cero compras y una venta. Al volver a A se recuperó el primer resultado. |
| JWT ausente en perfil privado, compras y ventas | Las tres rutas respondieron HTTP 401 y gRPC 16 (`Unauthenticated`) con «token de autorización no proporcionado». |
| JWT expirado en perfil privado, compras y ventas | Las tres rutas respondieron HTTP 401 y gRPC 16 (`Unauthenticated`) con «token inválido o expirado». |
| Perfil público A y B | HTTP 200. La respuesta correspondió al ID de la URL y solo incluyó campos del contrato público. Se verificaron consultas como visitante y desde la otra cuenta, además de una consulta con JWT expirado. No se expusieron correo, teléfono ni credenciales. |

El comando `go test ./internal/middleware -run '^TestUnaryAuthInterceptor_' -count=1` pasó en 0,107 s. La prueba de humo informó nueve líneas `PASS`, sin fallos reportados, y el PostgreSQL temporal se detuvo al terminar.

## Reproducción y alcance

Desde la raíz del repositorio se usó `run-all152.ps1` del entorno temporal en `%LOCALAPPDATA%\Temp\all152-qa`. El script compila `./cmd/iam` y `./cmd/orders`, arranca PostgreSQL, ejecuta las pruebas del interceptor y lanza la prueba HTTP. Las rutas verificadas fueron `POST /v1/auth/register`, `POST /v1/auth/login`, `PUT` y `GET /v1/auth/profile`, `GET /v1/auth/profile/{id}`, `GET /v1/orders/mis-compras` y `GET /v1/orders/mis-ventas`.

El cambio de identidad se verificó alternando sesiones en las solicitudes HTTP. La creación de una orden desde Catálogo, el cambio de cuenta desde la interfaz y la redirección en navegador quedan fuera de los resultados ejecutados aquí. Los casos probados no requirieron correcciones en el código de aplicación.

## Contrato para Francisco y ALL-182

En rutas protegidas, tanto un JWT ausente como uno expirado producen HTTP 401 y gRPC 16. La revisión de `frontend-marketplace/src/lib/axios.ts` confirmó que el cliente compartido limpia los tokens y el estado de autenticación ante un 401 y, si está fuera de login, redirige a `/login?session=expired`. ALL-182 puede utilizar este contrato para comprobar la reacción en el navegador.

El perfil público se puede consultar como visitante y su identidad corresponde al ID solicitado. Este resultado sirve de insumo para [ALL-187](https://linear.app/allin1/issue/ALL-187), que valida la identidad pública del vendedor en el recorrido de publicación.
