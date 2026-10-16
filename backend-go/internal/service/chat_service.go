package service

import (
	"context"
	"strings"

	chatpb "github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/api/pb/chat"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

// ChatServiceServer implementa el servicio gRPC ChatServiceServer
type ChatServiceServer struct {
	chatpb.UnimplementedChatServiceServer
	db *gorm.DB
}

// NewChatServiceServer inicializa el servidor del servicio de Chat
func NewChatServiceServer(db *gorm.DB) *ChatServiceServer {
	return &ChatServiceServer{db: db}
}

// SendMessage almacena y despacha un nuevo mensaje dentro de una sala
func (s *ChatServiceServer) SendMessage(ctx context.Context, req *chatpb.SendMessageRequest) (*chatpb.SendMessageResponse, error) {
	if err := ValidateSendMessageRequest(req); err != nil {
		return nil, err
	}

	remitenteID := extractUserID(ctx)
	if remitenteID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado")
	}

	mensaje := models.ChatMensaje{
		SalaID:         uint(req.GetSalaId()),
		RemitenteID:    remitenteID,
		DestinatarioID: uint(req.GetDestinatarioId()),
		Contenido:      strings.TrimSpace(req.GetContenido()),
		Leido:          false,
	}

	if s.db != nil {
		if err := s.db.WithContext(ctx).Create(&mensaje).Error; err != nil {
			return nil, status.Errorf(codes.Internal, "error al guardar mensaje: %v", err)
		}
	}

	return &chatpb.SendMessageResponse{
		Mensaje: mapMensajeModelToProto(&mensaje),
		Message: "Mensaje enviado exitosamente",
	}, nil
}

// GetMessages obtiene el historial paginado de mensajes de una conversación
func (s *ChatServiceServer) GetMessages(ctx context.Context, req *chatpb.GetMessagesRequest) (*chatpb.GetMessagesResponse, error) {
	if err := ValidateGetMessagesRequest(req); err != nil {
		return nil, err
	}

	limit := int(req.GetLimit())
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := int(req.GetOffset())
	if offset < 0 {
		offset = 0
	}

	var mensajes []models.ChatMensaje
	var total int64

	if s.db != nil {
		query := s.db.WithContext(ctx).Model(&models.ChatMensaje{}).Where("sala_id = ?", req.GetSalaId())
		if err := query.Count(&total).Error; err != nil {
			return nil, status.Errorf(codes.Internal, "error al contar mensajes: %v", err)
		}

		if err := query.Order("created_at ASC").Limit(limit).Offset(offset).Find(&mensajes).Error; err != nil {
			return nil, status.Errorf(codes.Internal, "error al obtener mensajes: %v", err)
		}
	}

	protoMensajes := make([]*chatpb.ChatMessage, 0, len(mensajes))
	for i := range mensajes {
		protoMensajes = append(protoMensajes, mapMensajeModelToProto(&mensajes[i]))
	}

	return &chatpb.GetMessagesResponse{
		Mensajes: protoMensajes,
		Total:    int32(total),
	}, nil
}

// GetOrCreateRoom busca o crea una sala de chat para un usuario con un vendedor
func (s *ChatServiceServer) GetOrCreateRoom(ctx context.Context, req *chatpb.GetOrCreateRoomRequest) (*chatpb.GetOrCreateRoomResponse, error) {
	currentUserID := extractUserID(ctx)
	if err := ValidateGetOrCreateRoomRequest(req, currentUserID); err != nil {
		return nil, err
	}

	var sala models.ChatSala
	if s.db != nil {
		query := s.db.WithContext(ctx).Where(
			"((comprador_id = ? AND vendedor_id = ?) OR (comprador_id = ? AND vendedor_id = ?))",
			currentUserID, req.GetVendedorId(), req.GetVendedorId(), currentUserID,
		)
		if req.PublicacionId != nil && *req.PublicacionId > 0 {
			query = query.Where("publicacion_id = ?", *req.PublicacionId)
		}

		err := query.First(&sala).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				var pubID *uint
				if req.PublicacionId != nil && *req.PublicacionId > 0 {
					p := uint(*req.PublicacionId)
					pubID = &p
				}
				sala = models.ChatSala{
					CompradorID:   currentUserID,
					VendedorID:    uint(req.GetVendedorId()),
					PublicacionID: pubID,
				}
				if err := s.db.WithContext(ctx).Create(&sala).Error; err != nil {
					return nil, status.Errorf(codes.Internal, "error al crear la sala de chat: %v", err)
				}
			} else {
				return nil, status.Errorf(codes.Internal, "error al consultar sala: %v", err)
			}
		}
	}

	return &chatpb.GetOrCreateRoomResponse{
		Sala: mapSalaModelToProto(&sala),
	}, nil
}

// ListRooms lista todas las salas en las que participa el usuario autenticado
func (s *ChatServiceServer) ListRooms(ctx context.Context, _ *chatpb.ListRoomsRequest) (*chatpb.ListRoomsResponse, error) {
	currentUserID := extractUserID(ctx)
	if currentUserID == 0 {
		return nil, status.Error(codes.Unauthenticated, "usuario no autenticado")
	}

	var salas []models.ChatSala
	if s.db != nil {
		err := s.db.WithContext(ctx).
			Where("comprador_id = ? OR vendedor_id = ?", currentUserID, currentUserID).
			Order("updated_at DESC").
			Find(&salas).Error
		if err != nil {
			return nil, status.Errorf(codes.Internal, "error al listar salas: %v", err)
		}
	}

	protoSalas := make([]*chatpb.ChatRoom, 0, len(salas))
	for i := range salas {
		protoSalas = append(protoSalas, mapSalaModelToProto(&salas[i]))
	}

	return &chatpb.ListRoomsResponse{
		Salas: protoSalas,
	}, nil
}

// MarkAsRead marca los mensajes recibidos de una sala como leídos
func (s *ChatServiceServer) MarkAsRead(ctx context.Context, req *chatpb.MarkAsReadRequest) (*chatpb.MarkAsReadResponse, error) {
	if req.GetSalaId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "el id de la sala es obligatorio")
	}

	currentUserID := extractUserID(ctx)
	if s.db != nil && currentUserID > 0 {
		err := s.db.WithContext(ctx).Model(&models.ChatMensaje{}).
			Where("sala_id = ? AND destinatario_id = ? AND leido = false", req.GetSalaId(), currentUserID).
			Update("leido", true).Error
		if err != nil {
			return nil, status.Errorf(codes.Internal, "error al marcar mensajes leídos: %v", err)
		}
	}

	return &chatpb.MarkAsReadResponse{
		Success: true,
		Message: "Mensajes marcados como leídos",
	}, nil
}

// GetUnreadCount retorna el total de mensajes no leídos dirigidos al usuario actual
func (s *ChatServiceServer) GetUnreadCount(ctx context.Context, _ *chatpb.GetUnreadCountRequest) (*chatpb.GetUnreadCountResponse, error) {
	currentUserID := extractUserID(ctx)
	if currentUserID == 0 {
		return &chatpb.GetUnreadCountResponse{UnreadCount: 0}, nil
	}

	var count int64
	if s.db != nil {
		err := s.db.WithContext(ctx).Model(&models.ChatMensaje{}).
			Where("destinatario_id = ? AND leido = false", currentUserID).
			Count(&count).Error
		if err != nil {
			return nil, status.Errorf(codes.Internal, "error al consultar mensajes no leídos: %v", err)
		}
	}

	return &chatpb.GetUnreadCountResponse{
		UnreadCount: uint32(count),
	}, nil
}

// ==========================================
// Funciones de Validación Puras (Testeables)
// ==========================================

func ValidateSendMessageRequest(req *chatpb.SendMessageRequest) error {
	if req == nil {
		return status.Error(codes.InvalidArgument, "request vacío")
	}
	if req.GetSalaId() == 0 {
		return status.Error(codes.InvalidArgument, "el id de sala es obligatorio")
	}
	if req.GetDestinatarioId() == 0 {
		return status.Error(codes.InvalidArgument, "el id del destinatario es obligatorio")
	}
	if strings.TrimSpace(req.GetContenido()) == "" {
		return status.Error(codes.InvalidArgument, "el contenido del mensaje no puede estar vacío")
	}
	return nil
}

func ValidateGetMessagesRequest(req *chatpb.GetMessagesRequest) error {
	if req == nil {
		return status.Error(codes.InvalidArgument, "request vacío")
	}
	if req.GetSalaId() == 0 {
		return status.Error(codes.InvalidArgument, "el id de sala es obligatorio")
	}
	return nil
}

func ValidateGetOrCreateRoomRequest(req *chatpb.GetOrCreateRoomRequest, currentUserID uint) error {
	if req == nil {
		return status.Error(codes.InvalidArgument, "request vacío")
	}
	if req.GetVendedorId() == 0 {
		return status.Error(codes.InvalidArgument, "el id del vendedor es obligatorio")
	}
	if currentUserID > 0 && currentUserID == uint(req.GetVendedorId()) {
		return status.Error(codes.InvalidArgument, "no puedes iniciar un chat contigo mismo")
	}
	return nil
}

func extractUserID(ctx context.Context) uint {
	if val, ok := ctx.Value(middleware.UserIDKey).(uint); ok {
		return val
	}
	return 0
}

func mapMensajeModelToProto(m *models.ChatMensaje) *chatpb.ChatMessage {
	return &chatpb.ChatMessage{
		IdMensaje:      uint32(m.IDMensaje),
		SalaId:         uint32(m.SalaID),
		RemitenteId:    uint32(m.RemitenteID),
		DestinatarioId: uint32(m.DestinatarioID),
		Contenido:      m.Contenido,
		Leido:          m.Leido,
		CreatedAt:      timestamppb.New(m.CreatedAt),
	}
}

func mapSalaModelToProto(s *models.ChatSala) *chatpb.ChatRoom {
	var pubID *uint32
	if s.PublicacionID != nil {
		p := uint32(*s.PublicacionID)
		pubID = &p
	}
	return &chatpb.ChatRoom{
		IdSala:        uint32(s.IDSala),
		CompradorId:   uint32(s.CompradorID),
		VendedorId:    uint32(s.VendedorID),
		PublicacionId: pubID,
		CreatedAt:     timestamppb.New(s.CreatedAt),
		UpdatedAt:     timestamppb.New(s.UpdatedAt),
	}
}
