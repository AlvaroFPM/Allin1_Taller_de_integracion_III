-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('VIEW', 'CLICK', 'FAVORITE', 'HIRE', 'SEARCH');

-- CreateTable
CREATE TABLE "interacciones_servicios" (
    "id_interaccion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "tipo_evento" "TipoEvento" NOT NULL,
    "fecha_interaccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacciones_servicios_pkey" PRIMARY KEY ("id_interaccion")
);

-- CreateTable
CREATE TABLE "recomendaciones_log" (
    "id_recomendacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_publicacion_recomendada" INTEGER NOT NULL,
    "score_afinidad" DECIMAL(5,4) NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recomendaciones_log_pkey" PRIMARY KEY ("id_recomendacion")
);

-- CreateIndex
CREATE INDEX "interacciones_servicios_id_usuario_idx" ON "interacciones_servicios"("id_usuario");

-- CreateIndex
CREATE INDEX "interacciones_servicios_id_publicacion_idx" ON "interacciones_servicios"("id_publicacion");

-- CreateIndex
CREATE INDEX "recomendaciones_log_id_usuario_idx" ON "recomendaciones_log"("id_usuario");

-- CreateIndex
CREATE INDEX "recomendaciones_log_id_publicacion_recomendada_idx" ON "recomendaciones_log"("id_publicacion_recomendada");
