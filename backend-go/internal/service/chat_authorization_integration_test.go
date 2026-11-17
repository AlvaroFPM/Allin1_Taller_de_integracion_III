package service

import (
	"context"
	"os"
	"testing"

	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestChatAuthorization_Postgres(t *testing.T) {
	dsn := os.Getenv("ALL147_TEST_DSN")
	if dsn == "" {
		t.Skip("requiere ALL147_TEST_DSN con una base de pruebas de Chat")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	// Todas las escrituras de esta prueba se revierten al terminar.
	tx := db.Begin()
	require.NoError(t, tx.Error)
	t.Cleanup(func() {
		_ = tx.Rollback().Error
	})

	svc := NewChatServiceServer(tx)

	sala := models.ChatSala{
		CompradorID: 101,
		VendedorID:  202,
	}
	require.NoError(t, tx.Create(&sala).Error)

	// Una sala eliminada tampoco debe permitir operaciones.
	salaEliminada := models.ChatSala{
		CompradorID: 101,
		VendedorID:  202,
	}
	require.NoError(t, tx.Create(&salaEliminada).Error)
	require.NoError(t, tx.Delete(&salaEliminada).Error)

	ctxUsuario := func(id uint) context.Context {
		return context.WithValue(
			context.Background(),
			middleware.UserIDKey,
			id,
		)
	}

	ctxA := ctxUsuario(101)
	ctxB := ctxUsuario(202)
	ctxTercero := ctxUsuario(303)

	enviar := func(ctx context.Context, salaID, destinatario uint, texto string) (
		*chatpb.SendMessageResponse, error,
	) {
		return svc.SendMessage(ctx, &chatpb.SendMessageRequest{
			SalaId:         uint32(salaID),
			DestinatarioId: uint32(destinatario),
			Contenido:      texto,
		})
	}

	// Ambos participantes pueden enviar y el remitente proviene del contexto.
	mensajeA, err := enviar(ctxA, sala.IDSala, 202, "Mensaje de A")
	require.NoError(t, err)
	require.Equal(t, uint32(101), mensajeA.GetMensaje().GetRemitenteId())
	require.Equal(t, uint32(202), mensajeA.GetMensaje().GetDestinatarioId())

	mensajeB, err := enviar(ctxB, sala.IDSala, 101, "Mensaje de B")
	require.NoError(t, err)
	require.Equal(t, uint32(202), mensajeB.GetMensaje().GetRemitenteId())
	require.Equal(t, uint32(101), mensajeB.GetMensaje().GetDestinatarioId())

	for _, ctx := range []context.Context{ctxA, ctxB} {
		historial, err := svc.GetMessages(ctx, &chatpb.GetMessagesRequest{
			SalaId: uint32(sala.IDSala),
			Limit:  10,
		})
		require.NoError(t, err)
		require.Equal(t, int32(2), historial.GetTotal())
		require.Len(t, historial.GetMensajes(), 2)
	}

	// Cada caso debe rechazar las tres operaciones.
	casos := []struct {
		nombre string
		ctx    context.Context
		salaID uint
		codigo codes.Code
	}{
		{
			nombre: "sin usuario autenticado",
			ctx:    context.Background(),
			salaID: sala.IDSala,
			codigo: codes.Unauthenticated,
		},
		{
			nombre: "usuario ajeno a la sala",
			ctx:    ctxTercero,
			salaID: sala.IDSala,
			codigo: codes.PermissionDenied,
		},
		{
			nombre: "sala eliminada",
			ctx:    ctxA,
			salaID: salaEliminada.IDSala,
			codigo: codes.NotFound,
		},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			envio, err := enviar(caso.ctx, caso.salaID, 202, "No guardar")
			require.Equal(t, caso.codigo, status.Code(err))
			require.Nil(t, envio)

			historial, err := svc.GetMessages(
				caso.ctx,
				&chatpb.GetMessagesRequest{
					SalaId: uint32(caso.salaID),
				},
			)
			require.Equal(t, caso.codigo, status.Code(err))
			require.Nil(t, historial)

			lectura, err := svc.MarkAsRead(
				caso.ctx,
				&chatpb.MarkAsReadRequest{
					SalaId: uint32(caso.salaID),
				},
			)
			require.Equal(t, caso.codigo, status.Code(err))
			require.Nil(t, lectura)
		})
	}

	// Un participante no puede enviar a terceros ni a sí mismo.
	for _, par := range []struct {
		ctx          context.Context
		destinatario uint
	}{
		{ctxA, 303},
		{ctxA, 101},
		{ctxB, 303},
		{ctxB, 202},
	} {
		resp, err := enviar(par.ctx, sala.IDSala, par.destinatario, "No guardar")
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		require.Nil(t, resp)
	}

	// Los intentos rechazados no insertaron ni marcaron mensajes.
	var cantidad int64
	require.NoError(t, tx.Model(&models.ChatMensaje{}).
		Where("sala_id = ?", sala.IDSala).
		Count(&cantidad).Error)
	require.Equal(t, int64(2), cantidad)

	var leidos int64
	require.NoError(t, tx.Model(&models.ChatMensaje{}).
		Where("sala_id = ? AND leido = true", sala.IDSala).
		Count(&leidos).Error)
	require.Zero(t, leidos)

	// A solo puede marcar el mensaje que recibió de B.
	lectura, err := svc.MarkAsRead(ctxA, &chatpb.MarkAsReadRequest{
		SalaId: uint32(sala.IDSala),
	})
	require.NoError(t, err)
	require.True(t, lectura.GetSuccess())

	var guardadoA, guardadoB models.ChatMensaje
	require.NoError(t, tx.First(
		&guardadoA,
		"id_mensaje = ?",
		mensajeA.GetMensaje().GetIdMensaje(),
	).Error)
	require.NoError(t, tx.First(
		&guardadoB,
		"id_mensaje = ?",
		mensajeB.GetMensaje().GetIdMensaje(),
	).Error)
	require.False(t, guardadoA.Leido)
	require.True(t, guardadoB.Leido)

	// B puede marcar lo recibido; repetir la operación también es válido.
	for intento := 0; intento < 2; intento++ {
		resp, err := svc.MarkAsRead(ctxB, &chatpb.MarkAsReadRequest{
			SalaId: uint32(sala.IDSala),
		})
		require.NoError(t, err)
		require.True(t, resp.GetSuccess())
	}

	require.NoError(t, tx.Model(&models.ChatMensaje{}).
		Where("sala_id = ? AND leido = true", sala.IDSala).
		Count(&leidos).Error)
	require.Equal(t, int64(2), leidos)
}
