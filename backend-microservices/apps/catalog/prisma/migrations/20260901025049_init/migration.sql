-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('OFERTA', 'DEMANDA');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'ELIMINADO');

-- CreateEnum
CREATE TYPE "TipoMultimedia" AS ENUM ('IMAGEN', 'VIDEO', 'DOCUMENTO');

-- CreateTable
CREATE TABLE "categorias" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icono_url" VARCHAR(255),

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "publicaciones" (
    "id_publicacion" SERIAL NOT NULL,
    "id_usuario_vendedor" INTEGER NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo_servicio" "TipoServicio" NOT NULL DEFAULT 'OFERTA',
    "precio_base" DECIMAL(12,2) NOT NULL,
    "ciudad" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_pkey" PRIMARY KEY ("id_publicacion")
);

-- CreateTable
CREATE TABLE "multimedia_publicaciones" (
    "id_multimedia" SERIAL NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "archivo_url" VARCHAR(255) NOT NULL,
    "tipo_archivo" "TipoMultimedia" NOT NULL DEFAULT 'IMAGEN',

    CONSTRAINT "multimedia_publicaciones_pkey" PRIMARY KEY ("id_multimedia")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id_etiqueta" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id_etiqueta")
);

-- CreateTable
CREATE TABLE "publicaciones_etiquetas" (
    "id_publicacion" INTEGER NOT NULL,
    "id_etiqueta" INTEGER NOT NULL,

    CONSTRAINT "publicaciones_etiquetas_pkey" PRIMARY KEY ("id_publicacion","id_etiqueta")
);

-- CreateTable
CREATE TABLE "guardados_favoritos" (
    "id_guardado" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "fecha_guardado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardados_favoritos_pkey" PRIMARY KEY ("id_guardado")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE INDEX "publicaciones_id_usuario_vendedor_idx" ON "publicaciones"("id_usuario_vendedor");

-- CreateIndex
CREATE INDEX "publicaciones_id_categoria_idx" ON "publicaciones"("id_categoria");

-- CreateIndex
CREATE INDEX "multimedia_publicaciones_id_publicacion_idx" ON "multimedia_publicaciones"("id_publicacion");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_key" ON "etiquetas"("nombre");

-- CreateIndex
CREATE INDEX "guardados_favoritos_id_usuario_idx" ON "guardados_favoritos"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "guardados_favoritos_id_usuario_id_publicacion_key" ON "guardados_favoritos"("id_usuario", "id_publicacion");

-- AddForeignKey
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia_publicaciones" ADD CONSTRAINT "multimedia_publicaciones_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "publicaciones"("id_publicacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_etiquetas" ADD CONSTRAINT "publicaciones_etiquetas_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "publicaciones"("id_publicacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_etiquetas" ADD CONSTRAINT "publicaciones_etiquetas_id_etiqueta_fkey" FOREIGN KEY ("id_etiqueta") REFERENCES "etiquetas"("id_etiqueta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardados_favoritos" ADD CONSTRAINT "guardados_favoritos_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "publicaciones"("id_publicacion") ON DELETE CASCADE ON UPDATE CASCADE;
