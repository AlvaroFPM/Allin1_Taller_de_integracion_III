-- CreateTable
CREATE TABLE "historial_busquedas" (
    "id_busqueda" SERIAL NOT NULL,
    "id_usuario" INTEGER,
    "termino_busqueda" VARCHAR(150) NOT NULL,
    "filtros_aplicados" JSONB,
    "fecha_busqueda" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_busquedas_pkey" PRIMARY KEY ("id_busqueda")
);

-- CreateTable
CREATE TABLE "sugerencias_populares" (
    "id_sugerencia" SERIAL NOT NULL,
    "palabra_clave" VARCHAR(100) NOT NULL,
    "contador_busquedas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sugerencias_populares_pkey" PRIMARY KEY ("id_sugerencia")
);

-- CreateIndex
CREATE INDEX "historial_busquedas_id_usuario_idx" ON "historial_busquedas"("id_usuario");

-- CreateIndex
CREATE INDEX "historial_busquedas_termino_busqueda_idx" ON "historial_busquedas"("termino_busqueda");

-- CreateIndex
CREATE UNIQUE INDEX "sugerencias_populares_palabra_clave_key" ON "sugerencias_populares"("palabra_clave");
