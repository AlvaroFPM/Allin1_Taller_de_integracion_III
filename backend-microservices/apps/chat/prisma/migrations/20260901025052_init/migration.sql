-- CreateTable
CREATE TABLE "conversaciones" (
    "id_conversacion" SERIAL NOT NULL,
    "id_participante_1" INTEGER NOT NULL,
    "id_participante_2" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_mensaje_at" TIMESTAMP(3),

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id_conversacion")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id_mensaje" SERIAL NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "id_remitente" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateIndex
CREATE INDEX "conversaciones_id_participante_1_idx" ON "conversaciones"("id_participante_1");

-- CreateIndex
CREATE INDEX "conversaciones_id_participante_2_idx" ON "conversaciones"("id_participante_2");

-- CreateIndex
CREATE INDEX "mensajes_id_conversacion_idx" ON "mensajes"("id_conversacion");

-- CreateIndex
CREATE INDEX "mensajes_id_remitente_idx" ON "mensajes"("id_remitente");

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversaciones"("id_conversacion") ON DELETE CASCADE ON UPDATE CASCADE;
