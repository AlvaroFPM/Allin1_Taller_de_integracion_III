# 🚀 Backend Go - Guía de Desarrollo (Monorepo)

Este directorio contiene todo el backend del proyecto, estructurado como un **Monorepo** basado en la **Arquitectura Limpia (Clean Architecture)** y el **Standard Go Project Layout**. 

Aquí conviven múltiples microservicios (IAM, Catalog, Media) que comparten código base, pero que se ejecutan de manera independiente.

---

## 📂 Estructura de Carpetas

Entender dónde va cada pedazo de código es clave para no hacer código "espagueti":

- 📁 **`api/proto/`**: **EL CONTRATO**. Aquí van todos los archivos `.proto`. Si quieres crear un nuevo endpoint o cambiar lo que recibe/devuelve, debes hacerlo aquí primero. Go usará esto para autogenerar código.
- 📁 **`cmd/`**: **LOS EJECUTABLES**. Contiene una carpeta por cada microservicio (`iam`, `catalog`, `media`). Dentro de cada una hay un `main.go`. **Aquí no va lógica de negocio**, solo inicialización (conectar a BD, levantar el servidor gRPC y el Gateway).
- 📁 **`internal/`**: **CÓDIGO PRIVADO COMPARTIDO**. Este es el corazón de la aplicación.
  - 📂 **`api/`**: Los controladores (Handlers). Reciben la petición gRPC o HTTP, extraen los datos y llaman a la lógica de negocio.
  - 📂 **`service/`**: **La Lógica de Negocio**. Aquí pones tus condicionales, cálculos, hasheo de contraseñas, validaciones, etc. No debe saber nada sobre HTTP ni gRPC, solo recibe datos puros.
  - 📂 **`models/`**: Las entidades y estructuras de datos (Structs) compartidas, como `User` o `Publication` (las que mapea GORM a la base de datos).
  - 📂 **`database/`**: Código de conexión a bases de datos (Postgres, Redis).
  - 📂 **`middleware/`**: Interceptores de gRPC (ej. para validar el token JWT).

---

## 🛠️ Flujo de Trabajo: ¿Cómo programar algo nuevo?

Si te asignan hacer el CRUD de "Categorías", este es el orden estricto que debes seguir:

1. **El Contrato:** Vas a `api/proto/` y defines los mensajes y el servicio gRPC en un archivo `.proto`.
2. **Compilar:** Ejecutas el comando de `protoc` (o el script/Makefile que tendremos pronto) para generar el código Go automáticamente.
3. **El Modelo:** Vas a `internal/models/` y creas el Struct de Go que representará la tabla en PostgreSQL para GORM.
4. **La Lógica:** Vas a `internal/service/` y programas las funciones reales (ej. `CreateCategory(name string) error`).
5. **El Controlador:** Vas a `internal/api/` e implementas la interfaz autogenerada por gRPC, inyectándole tu servicio.
6. **El Enlace:** Vas a `cmd/tu-microservicio/main.go` y registras tu nuevo controlador en el servidor gRPC antes de levantarlo.

---

## 🚀 ¿Cómo levantar un microservicio localmente?

Primero asegúrate de tener tu base de datos corriendo en Docker (`docker-compose up -d`).

Luego, para iniciar un microservicio específico, posicionate en esta carpeta (`backend-go/`) y ejecuta:

```bash
# Para levantar el microservicio de Autenticación:
go run cmd/iam/main.go

# Para levantar el microservicio de Publicaciones:
go run cmd/catalog/main.go

# Para levantar el microservicio de Imágenes:
go run cmd/media/main.go
```

**⚠️ Regla de Oro:**
¡Nunca importes dependencias de un microservicio a otro directamente si no están en `internal/`! Si `iam` necesita hablar con `catalog`, lo debe hacer llamando a su API a través de gRPC, no importando su código.
