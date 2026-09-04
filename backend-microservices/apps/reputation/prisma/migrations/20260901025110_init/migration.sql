-- CreateTable
CREATE TABLE "metricas_reputacion" (
    "id_metrica" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "promedio_estrellas" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    "total_resenas" INTEGER NOT NULL DEFAULT 0,
    "trabajos_completados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "metricas_reputacion_pkey" PRIMARY KEY ("id_metrica")
);

-- CreateTable
CREATE TABLE "calificaciones_resenas" (
    "id_calificacion" SERIAL NOT NULL,
    "id_metrica" INTEGER NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_evaluador" INTEGER NOT NULL,
    "id_evaluado" INTEGER NOT NULL,
    "puntuacion" SMALLINT NOT NULL,
    "comentario" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calificaciones_resenas_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "metricas_reputacion_id_usuario_key" ON "metricas_reputacion"("id_usuario");

-- CreateIndex
CREATE INDEX "metricas_reputacion_id_usuario_idx" ON "metricas_reputacion"("id_usuario");

-- CreateIndex
CREATE INDEX "calificaciones_resenas_id_orden_idx" ON "calificaciones_resenas"("id_orden");

-- CreateIndex
CREATE INDEX "calificaciones_resenas_id_evaluador_idx" ON "calificaciones_resenas"("id_evaluador");

-- CreateIndex
CREATE INDEX "calificaciones_resenas_id_evaluado_idx" ON "calificaciones_resenas"("id_evaluado");

-- CreateIndex
CREATE UNIQUE INDEX "calificaciones_resenas_id_orden_id_evaluador_key" ON "calificaciones_resenas"("id_orden", "id_evaluador");

-- AddForeignKey
ALTER TABLE "calificaciones_resenas" ADD CONSTRAINT "calificaciones_resenas_id_metrica_fkey" FOREIGN KEY ("id_metrica") REFERENCES "metricas_reputacion"("id_metrica") ON DELETE CASCADE ON UPDATE CASCADE;
