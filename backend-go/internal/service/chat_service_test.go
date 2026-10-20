package service

import (
	"context"
	"testing"

	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestValidateSendMessageRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *chatpb.SendMessageRequest
		expectError bool
		expectedMsg string
	}{
		{
			name:        "Request nulo",
			req:         nil,
			expectError: true,
			expectedMsg: "request vacío",
		},
		{
			name: "Sala ID en 0",
			req: &chatpb.SendMessageRequest{
				SalaId:         0,
				DestinatarioId: 2,
				Contenido:      "Hola",
			},
			expectError: true,
			expectedMsg: "el id de sala es obligatorio",
		},
		{
			name: "Destinatario ID en 0",
			req: &chatpb.SendMessageRequest{
				SalaId:         1,
				DestinatarioId: 0,
				Contenido:      "Hola",
			},
			expectError: true,
			expectedMsg: "el id del destinatario es obligatorio",
		},
		{
			name: "Contenido vacío",
			req: &chatpb.SendMessageRequest{
				SalaId:         1,
				DestinatarioId: 2,
				Contenido:      "   ",
			},
			expectError: true,
			expectedMsg: "el contenido del mensaje no puede estar vacío",
		},
		{
			name: "Request válido",
			req: &chatpb.SendMessageRequest{
				SalaId:         1,
				DestinatarioId: 2,
				Contenido:      "Hola, me interesa el servicio",
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSendMessageRequest(tc.req)
			if tc.expectError {
				assert.Error(t, err)
				st, ok := status.FromError(err)
				assert.True(t, ok)
				assert.Equal(t, codes.InvalidArgument, st.Code())
				assert.Contains(t, st.Message(), tc.expectedMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateGetMessagesRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *chatpb.GetMessagesRequest
		expectError bool
	}{
		{
			name:        "Request nulo",
			req:         nil,
			expectError: true,
		},
		{
			name: "Sala ID en 0",
			req: &chatpb.GetMessagesRequest{
				SalaId: 0,
			},
			expectError: true,
		},
		{
			name: "Request válido",
			req: &chatpb.GetMessagesRequest{
				SalaId: 10,
				Limit:  20,
				Offset: 0,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateGetMessagesRequest(tc.req)
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateGetOrCreateRoomRequest(t *testing.T) {
	tests := []struct {
		name          string
		req           *chatpb.GetOrCreateRoomRequest
		currentUserID uint
		expectError   bool
		expectedMsg   string
	}{
		{
			name:        "Request nulo",
			req:         nil,
			expectError: true,
			expectedMsg: "request vacío",
		},
		{
			name: "Vendedor ID en 0",
			req: &chatpb.GetOrCreateRoomRequest{
				VendedorId: 0,
			},
			currentUserID: 5,
			expectError:   true,
			expectedMsg:   "el id del vendedor es obligatorio",
		},
		{
			name: "Usuario intenta chatear consigo mismo",
			req: &chatpb.GetOrCreateRoomRequest{
				VendedorId: 5,
			},
			currentUserID: 5,
			expectError:   true,
			expectedMsg:   "no puedes iniciar un chat contigo mismo",
		},
		{
			name: "Request válido",
			req: &chatpb.GetOrCreateRoomRequest{
				VendedorId: 9,
			},
			currentUserID: 5,
			expectError:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateGetOrCreateRoomRequest(tc.req, tc.currentUserID)
			if tc.expectError {
				assert.Error(t, err)
				if tc.expectedMsg != "" {
					assert.Contains(t, err.Error(), tc.expectedMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestChatService_SendMessage_Unauthenticated(t *testing.T) {
	svc := NewChatServiceServer(nil)
	req := &chatpb.SendMessageRequest{
		SalaId:         1,
		DestinatarioId: 2,
		Contenido:      "Mensaje de prueba",
	}

	// Sin usuario en contexto
	ctx := context.Background()
	resp, err := svc.SendMessage(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, resp)
	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Unauthenticated, st.Code())
}

func TestChatService_SendMessage_Authenticated(t *testing.T) {
	svc := NewChatServiceServer(nil)
	req := &chatpb.SendMessageRequest{
		SalaId:         1,
		DestinatarioId: 2,
		Contenido:      "Hola mundo",
	}

	// Con usuario autenticado en contexto (id = 7)
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, uint(7))
	resp, err := svc.SendMessage(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, uint32(1), resp.GetMensaje().GetSalaId())
	assert.Equal(t, uint32(7), resp.GetMensaje().GetRemitenteId())
	assert.Equal(t, uint32(2), resp.GetMensaje().GetDestinatarioId())
	assert.Equal(t, "Hola mundo", resp.GetMensaje().GetContenido())
}
