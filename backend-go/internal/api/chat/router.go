package chat

import (
	"context"

	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RegisterGRPCRouter registra los servicios y reflection en el servidor gRPC de Chat
func RegisterGRPCRouter(server *grpc.Server, chatService chatpb.ChatServiceServer) {
	chatpb.RegisterChatServiceServer(server, chatService)
	reflection.Register(server)
}

// RegisterGatewayRouter registra el handler de gRPC-Gateway para conectar endpoints REST al servidor gRPC
func RegisterGatewayRouter(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
	return chatpb.RegisterChatServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)
}
