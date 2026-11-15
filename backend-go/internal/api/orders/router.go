package orders

import (
	"context"

	orderspb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/orders"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RegisterGRPCRouter registra el servicio OrderService y la reflexión en el servidor gRPC de Orders.
func RegisterGRPCRouter(server *grpc.Server, orderServer orderspb.OrderServiceServer) {
	orderspb.RegisterOrderServiceServer(server, orderServer)
	reflection.Register(server)
}

// RegisterGatewayRouter registra el handler de gRPC-Gateway para conectar los endpoints REST al servidor gRPC.
func RegisterGatewayRouter(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
	return orderspb.RegisterOrderServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)
}

