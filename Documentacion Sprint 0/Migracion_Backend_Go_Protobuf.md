# Migración del Backend: De Node.js/NestJS a Go y gRPC (Protobuf)

Este documento detalla las razones, el contexto y las ventajas del cambio de arquitectura y stack tecnológico en el backend de nuestro proyecto.

## 1. El Contexto: ¿Qué teníamos y qué tenemos ahora?

### **El Stack Anterior (backend-microservices)**
- **Lenguaje / Entorno:** TypeScript sobre Node.js.
- **Framework:** NestJS.
- **ORM / Base de Datos:** Prisma ORM.
- **Arquitectura:** Monorepo basado en las herramientas de NestJS (aplicaciones y librerías).
- **Comunicación:** Principalmente APIs REST (HTTP/1.1) y WebSockets (Socket.io).

### **El Stack Actual (backend-go)**
- **Lenguaje / Entorno:** Go (Golang).
- **Contratos / Serialización:** Protocol Buffers (Protobuf).
- **Comunicación:** gRPC (RPC sobre HTTP/2) para comunicación interna, y gRPC-Gateway para exponer una API REST externa.
- **ORM / Base de Datos:** GORM (PostgreSQL) y conectores nativos (Redis).
- **Arquitectura:** Monorepo de microservicios (`iam`, `catalog`, `media`) bajo los principios de *Clean Architecture* y el *Standard Go Project Layout*.

---

## 2. ¿Por qué se decidió el cambio? (Los Problemas del Stack Anterior)

Aunque NestJS y Node.js son excelentes herramientas, a medida que la arquitectura de microservicios crece, presentan ciertos desafíos técnicos que motivaron la transición:

1. **Rendimiento y Concurrencia (El cuello de botella de Node.js):** 
   Node.js utiliza un modelo de un solo hilo (*single-threaded event loop*). Aunque es bueno para I/O asíncrono, se vuelve un cuello de botella en operaciones intensivas o cuando hay picos masivos de concurrencia.
2. **Sobrecarga (Overhead) del Framework:**
   NestJS es muy completo pero también muy pesado. Levantar múltiples microservicios en NestJS consume considerable memoria RAM y tiempo de CPU debido a la inyección de dependencias dinámica (Reflection) y el arranque de Node.js.
3. **Contratos Débiles en la Comunicación:**
   En microservicios que se comunican por REST/JSON, si el equipo A cambia la estructura del JSON, el equipo B puede romperse en producción sin previo aviso. TypeScript ayuda dentro del mismo monolito, pero pierde fuerza al cruzar la red si no se usan herramientas como OpenAPI de forma estricta.
4. **Ineficiencia de REST/JSON:**
   Serializar y deserializar JSON consume ciclos de CPU innecesarios. Además, las cabeceras HTTP/1.1 de REST añaden peso extra a cada petición interna entre microservicios.

---

## 3. Ventajas y Beneficios del Nuevo Stack (Go + Protobuf/gRPC)

La transición a **Go** y **gRPC** soluciona directamente los problemas mencionados y añade ventajas a nivel de infraestructura y experiencia de desarrollo.

### A. Rendimiento Superior y Bajo Consumo (Go)
- **Compilado y Nativo:** Go es un lenguaje compilado. Produce un único archivo binario que arranca en milisegundos y no necesita una máquina virtual (como la JVM o Node/V8).
- **Goroutines (Concurrencia Nativa):** Go fue diseñado para la nube y la concurrencia. Una *goroutine* consume apenas 2KB de RAM (frente a los megabytes de un hilo de SO o un worker en Node), lo que permite manejar decenas de miles de peticiones simultáneas sin transpirar.
- **Menor Costo de Infraestructura:** Al ser más eficiente en CPU y Memoria, podemos ejecutar más microservicios en servidores más pequeños o contenedores más baratos.

### B. Contratos Estrictos y Seguros (Protobuf)
- **API First:** Con Protocol Buffers (archivos `.proto`), **el contrato de comunicación se define antes de escribir código**. Es la única fuente de verdad.
- **Autogeneración de Código:** A partir del archivo `.proto`, se genera automáticamente el código cliente y servidor en Go. Si cambias el contrato y rompes algo, el código no compilará. ¡Los errores se atrapan antes de producción!
- **Agnóstico al Lenguaje:** Si el día de mañana queremos escribir un microservicio de Inteligencia Artificial en Python, puede comunicarse nativamente con el backend en Go usando el mismo archivo `.proto`.

### C. Eficiencia de Red y Velocidad (gRPC)
- **Binario vs Texto:** A diferencia de JSON (texto plano), Protobuf es un formato binario altamente comprimido. Los *payloads* viajan más rápido y pesan mucho menos.
- **HTTP/2 por Defecto:** gRPC usa HTTP/2, lo que permite multiplexación (enviar múltiples peticiones en paralelo por la misma conexión TCP) y *streaming* bidireccional.
- **gRPC-Gateway:** No perdemos compatibilidad con el frontend (React/Next). Gracias al Gateway, podemos exponer los servicios gRPC como una API REST tradicional (JSON) hacia el exterior, de forma totalmente automática y sin escribir código duplicado.

### D. Clean Architecture y Estructura Clara
- La nueva estructura (`cmd/`, `internal/api/`, `internal/service/`, `internal/models/`) fuerza una separación de responsabilidades estricta. 
- La lógica de negocio (`service/`) no sabe nada de bases de datos o de peticiones web. Esto hace que el código sea extremadamente fácil de testear (Unit Testing) y mantener a largo plazo.

---

## Conclusión

El paso de **Node.js/NestJS a Go/Protobuf** es un salto de madurez arquitectónica. Cambiamos un entorno flexible pero pesado (REST/Node) por uno **estricto, ultra-rápido y altamente escalable**. Esto nos preparará para soportar alta concurrencia, reducir costos de nube y garantizar que los microservicios se comuniquen de forma segura y sin errores inesperados.
