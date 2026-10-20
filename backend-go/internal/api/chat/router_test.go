package chat

import (
	"context"
	"net"
	"testing"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestRegisterGRPCRouter(t *testing.T) {
	grpcServer := grpc.NewServer()
	chatService := service.NewChatServiceServer(nil)

	assert.NotPanics(t, func() {
		RegisterGRPCRouter(grpcServer, chatService)
	})

	services := grpcServer.GetServiceInfo()
	assert.Contains(t, services, "chat.ChatService")
}

func TestRegisterGatewayRouter(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer lis.Close()

	grpcServer := grpc.NewServer()
	chatService := service.NewChatServiceServer(nil)
	RegisterGRPCRouter(grpcServer, chatService)

	go func() {
		_ = grpcServer.Serve(lis)
	}()
	defer grpcServer.Stop()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	ctx := context.Background()
	err = RegisterGatewayRouter(ctx, mux, lis.Addr().String(), opts)
	assert.NoError(t, err)
}
