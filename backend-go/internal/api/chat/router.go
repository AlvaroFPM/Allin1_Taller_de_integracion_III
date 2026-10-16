package chat

import (
	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RegisterGRPCRouter registra los servicios y reflection en el servidor gRPC de Chat
func RegisterGRPCRouter(server *grpc.Server, chatService chatpb.ChatServiceServer) {
	chatpb.RegisterChatServiceServer(server, chatService)
	reflection.Register(server)
}
