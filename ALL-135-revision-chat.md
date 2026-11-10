# ALL-135 — Revisión previa al refactor de Chat

## Base comprobada
Repositorio: AlvaroFPM/Allin1_Taller_de_integracion_III.
Commit revisado: b3dc9ad51c97bccc5bdb8aba8fc44d0449ff7bad. main y develop resolvían a este commit durante la consulta; el usuario confirmó HEAD local en develop con el mismo valor. No se comprobó el clúster.
Esta entrega es una revisión, no implementación ni cierre de la issue.

## Inventario y trazabilidad
Entrada HTTP/gRPC → gateway/registro → autenticación → servicio → GORM → base de datos.
- backend-go/cmd/chat/main.go: conexión a BD, AutoMigrate de ChatSala/ChatMensaje, interceptor y registro de servidores. Arranque no ejecutado.
- backend-go/internal/api/chat/router.go: registro gRPC y gateway generado.
- backend-go/api/proto/chat.proto y backend-go/internal/api/pb/chat: contrato y código generado; fuera del refactor.
- backend-go/internal/models/chat.go: modelos persistentes.
- frontend-marketplace/src/types/dto/chat.ts: DTO consumidor; conservar campos públicos. No se encontró cliente Chat operativo en la búsqueda realizada, sin garantizar otras ramas.

Las siguientes operaciones están en backend-go/internal/service/chat_service.go y las consume RPC/gateway:

| Operación | Entrada → salida | Efectos que preservar |
| --- | --- | --- |
| SendMessage | Sala, destinatario, contenido, usuario contexto → mensaje | Validación, recorte de contenido, Create de ChatMensaje cuando hay BD, Leido=false. |
| GetMessages | Sala, limit, offset → mensajes y total | Count/Find, created_at ASC, normalización limit/offset. |
| GetOrCreateRoom | Vendedor, publicación opcional, usuario → sala | Búsqueda de pareja en ambos sentidos; filtro publicación positiva; creación ante gorm.ErrRecordNotFound. |
| ListRooms | Usuario → salas | Consulta comprador/vendedor, updated_at DESC. |
| MarkAsRead | Sala, usuario → resultado | Actualización de no leídos del destinatario; conservar conducta actual sin usuario/BD. |
| GetUnreadCount | Usuario → contador | Count por destinatario/no leído; sin usuario retorna cero. |

Validadores: entradas request → error o aceptación, usados por las operaciones correspondientes y pruebas. extractUserID: contexto → ID o cero; usado por cinco operaciones, no por GetMessages. mapMensajeModelToProto: modelo → mensaje, usado por envío/historial. mapSalaModelToProto: modelo → sala, usado por búsqueda/listado. Los mappers no escriben en BD.
Autenticación del interceptor no equivale a autorización por pertenencia a sala.

## Propuesta acotada para ALL-136
1. Aplanar condiciones anidadas de error en GetOrCreateRoom. Mantener comparación exacta con gorm.ErrRecordNotFound, consultas, orden, inserciones, respuestas y textos. No sustituir por errors.Is suponiendo equivalencia.
2. Quitar var db *gorm.DB redundante de cmd/chat/main.go y su importación gorm.io/gorm si queda sin usos. Mantener conexión y arranque.
No crear funciones, métodos, endpoints, dependencias ni capacidades. No cambiar contratos, autorización, reglas, persistencia o comportamiento visible. Conservar guardas de BD nil utilizadas por pruebas.

## Evidencia previa aportada por el usuario
Registro: 10/11/2026. Go informado: go1.27.1 windows/amd64.
- Suite service + api/chat + middleware: FAIL en service por conexiones locales rechazadas a IAM (5433) y Catalog (5434); api/chat y middleware OK. No atribuir ese fallo a Chat.
- go build ./...: retorno al prompt sin errores visibles; código de salida no capturado explícitamente.
- Pruebas aisladas:

```powershell
go test ./internal/service -run '^(TestValidateSendMessageRequest|TestValidateGetMessagesRequest|TestValidateGetOrCreateRoomRequest|TestChatService_SendMessage_Unauthenticated|TestChatService_SendMessage_Authenticated)$' -count=1 -v
```

Resultado aportado: PASS, paquete internal/service OK, 1.197s; cinco pruebas principales y sus subcasos aprobados. Validaciones nominales y errores; envío con/sin usuario. El envío se prueba con BD nil: NO demuestra persistencia, autorización por recurso ni flujo HTTP completo. Tampoco verifica consultas de GetOrCreateRoom.

## Comparación antes/después definida, pendiente de ejecutar tras cambios
- Repetir pruebas aisladas, router, middleware y compilación; conservar diff/resultados. La suite general fallida no pasa a considerarse aprobada.
- GetOrCreateRoom con BD de pruebas aislada: sala encontrada sin INSERT; ausencia con INSERT; error SELECT sin INSERT; error INSERT con mismo código/texto; publicación nil/cero/positiva y pareja inversa. Comparar respuestas y efectos antes/después. Casos definidos, NO ejecutados; comprobar seguridad/configuración de pruebas antes de ejecutarlos.
- Limpieza main: compilación y diff sin alteración de arranque. Compilación no prueba arranque.
- ALL-178 exige revisión cruzada con compañero y observaciones verificables; no realizada.

## Hallazgos fuera del refactor
- Pertenencia a sala/destinatario: revisar en ALL-147; no resuelta.
- Persistencia/arranque con BD real y conducta BD nil: revisar en ALL-148; no resuelta.
- Posible duplicación concurrente de salas: revisar en ALL-190; no reproducida.
- Envío no actualiza explícitamente updated_at de sala; mapper no completa último mensaje/no leídos. Hallazgos de código, no fallos reproducidos; no se cambian ni se crean issues automáticamente.

## Pendientes
Guardar y enlazar informe/commit/PR o registro pertinente según entrega de ALL-135. Refactor no aplicado. Estados y relaciones de Linear sin cambios. Faltan pruebas DB antes/después y revisión cruzada. Sin evidencia de ejecución en clúster.
Diagrama localizado: Documentacion Sprint 0/Diagramas Allin1/Diagrama de componentes.png; fuente editable no localizada, sin actualización ni esfuerzo adicional contabilizado.
