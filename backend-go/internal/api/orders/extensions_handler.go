package orders

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/middleware"
	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	maxNotesRunes         = 500
	maxScheduledDateRunes = 120
	maxReviewCommentRunes = 500
	maxExtrasBatchIDs     = 100
)

// ExtensionsHandler expone endpoints REST complementarios del flujo de órdenes
// (notas/fecha, confirmación de entrega del vendedor, reseñas y resumen de pendientes)
// sin modificar los contratos gRPC existentes.
type ExtensionsHandler struct {
	db *gorm.DB
}

func NewExtensionsHandler(db *gorm.DB) *ExtensionsHandler {
	return &ExtensionsHandler{db: db}
}

// WrapHandler envuelve el router principal de gRPC-Gateway para despachar las rutas
// complementarias antes de delegar el resto a gRPC-Gateway.
func (h *ExtensionsHandler) WrapHandler(gateway http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		switch {
		case path == "/v1/orders/extras" && r.Method == http.MethodGet:
			middleware.HTTPAuth(http.HandlerFunc(h.handleGetExtras)).ServeHTTP(w, r)
			return
		case path == "/v1/orders/pending-summary" && r.Method == http.MethodGet:
			middleware.HTTPAuth(http.HandlerFunc(h.handlePendingSummary)).ServeHTTP(w, r)
			return
		case strings.HasPrefix(path, "/v1/reviews/user/") && r.Method == http.MethodGet:
			h.handleGetUserReviews(w, r)
			return
		case strings.HasPrefix(path, "/v1/orders/"):
			trimmed := strings.TrimPrefix(path, "/v1/orders/")
			parts := strings.Split(trimmed, "/")
			if len(parts) == 2 {
				orderID, err := parsePositiveUint(parts[0])
				if err == nil {
					switch {
					case parts[1] == "extras" && r.Method == http.MethodPut:
						middleware.HTTPAuth(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
							h.handleSaveExtras(rw, req, orderID)
						})).ServeHTTP(w, r)
						return
					case parts[1] == "deliver" && r.Method == http.MethodPost:
						middleware.HTTPAuth(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
							h.handleMarkDelivered(rw, req, orderID)
						})).ServeHTTP(w, r)
						return
					case parts[1] == "review" && r.Method == http.MethodPost:
						middleware.HTTPAuth(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
							h.handleCreateReview(rw, req, orderID)
						})).ServeHTTP(w, r)
						return
					}
				}
			}
		}

		gateway.ServeHTTP(w, r)
	})
}

type orderExtraPayload struct {
	IDOrden                 uint                 `json:"idOrden"`
	Notas                   string               `json:"notas"`
	FechaAcordada           string               `json:"fechaAcordada"`
	VendedorConfirmoEntrega bool                 `json:"vendedorConfirmoEntrega"`
	FechaEntregaVendedor    *time.Time           `json:"fechaEntregaVendedor,omitempty"`
	Review                  *models.OrderReview  `json:"review,omitempty"`
}

func (h *ExtensionsHandler) handleGetExtras(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	idsParam := strings.TrimSpace(r.URL.Query().Get("ids"))
	if idsParam == "" {
		writeJSON(w, http.StatusOK, map[string]any{"extras": map[string]orderExtraPayload{}})
		return
	}

	rawParts := strings.Split(idsParam, ",")
	if len(rawParts) > maxExtrasBatchIDs {
		rawParts = rawParts[:maxExtrasBatchIDs]
	}

	requestedIDs := make([]uint, 0, len(rawParts))
	seen := make(map[uint]struct{}, len(rawParts))
	for _, raw := range rawParts {
		id, err := parsePositiveUint(strings.TrimSpace(raw))
		if err != nil {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		requestedIDs = append(requestedIDs, id)
	}

	if len(requestedIDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"extras": map[string]orderExtraPayload{}})
		return
	}

	// Autorizar: solo devolver metadatos de órdenes donde el solicitante participa.
	var allowedOrderIDs []uint
	if err := h.db.WithContext(r.Context()).
		Model(&models.Orden{}).
		Where("id_orden IN ? AND (id_usuario_comprador = ? OR id_usuario_vendedor = ?)", requestedIDs, userID, userID).
		Pluck("id_orden", &allowedOrderIDs).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al verificar permisos de órdenes")
		return
	}

	if len(allowedOrderIDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"extras": map[string]orderExtraPayload{}})
		return
	}

	var extras []models.OrderExtra
	if err := h.db.WithContext(r.Context()).
		Where("id_orden IN ?", allowedOrderIDs).
		Find(&extras).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al consultar detalles de órdenes")
		return
	}

	var reviews []models.OrderReview
	if err := h.db.WithContext(r.Context()).
		Where("id_orden IN ?", allowedOrderIDs).
		Find(&reviews).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al consultar reseñas de órdenes")
		return
	}

	result := make(map[string]orderExtraPayload, len(allowedOrderIDs))
	for _, ex := range extras {
		key := strconv.FormatUint(uint64(ex.IDOrden), 10)
		result[key] = orderExtraPayload{
			IDOrden:                 ex.IDOrden,
			Notas:                   ex.Notas,
			FechaAcordada:           ex.FechaAcordada,
			VendedorConfirmoEntrega: ex.VendedorConfirmoEntrega,
			FechaEntregaVendedor:    ex.FechaEntregaVendedor,
		}
	}
	for i := range reviews {
		rev := reviews[i]
		key := strconv.FormatUint(uint64(rev.IDOrden), 10)
		entry := result[key]
		entry.IDOrden = rev.IDOrden
		entry.Review = &rev
		result[key] = entry
	}

	writeJSON(w, http.StatusOK, map[string]any{"extras": result})
}

func (h *ExtensionsHandler) handleSaveExtras(w http.ResponseWriter, r *http.Request, orderID uint) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	var req struct {
		Notas         string `json:"notas"`
		FechaAcordada string `json:"fechaAcordada"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "cuerpo JSON inválido")
		return
	}

	notas := strings.TrimSpace(req.Notas)
	fecha := strings.TrimSpace(req.FechaAcordada)
	if utf8.RuneCountInString(notas) > maxNotesRunes {
		writeJSONError(w, http.StatusBadRequest, "las notas no pueden superar los 500 caracteres")
		return
	}
	if utf8.RuneCountInString(fecha) > maxScheduledDateRunes {
		writeJSONError(w, http.StatusBadRequest, "la fecha o coordinación no puede superar los 120 caracteres")
		return
	}

	var orden models.Orden
	if err := h.db.WithContext(r.Context()).First(&orden, orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeJSONError(w, http.StatusNotFound, "orden no encontrada")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "error al buscar la orden")
		return
	}

	if orden.IDUsuarioComprador != userID {
		writeJSONError(w, http.StatusForbidden, "solo el comprador puede registrar notas o fecha en la orden")
		return
	}
	if orden.Estado != models.EstadoOrdenPendiente {
		writeJSONError(w, http.StatusConflict, "solo se pueden editar notas y fecha mientras la orden está PENDIENTE")
		return
	}

	extra := models.OrderExtra{
		IDOrden:       orderID,
		Notas:         notas,
		FechaAcordada: fecha,
	}
	if err := h.db.WithContext(r.Context()).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id_orden"}},
		DoUpdates: clause.AssignmentColumns([]string{"notas", "fecha_acordada", "fecha_actualizacion"}),
	}).Create(&extra).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al guardar notas de la orden")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"extra": extra})
}

func (h *ExtensionsHandler) handleMarkDelivered(w http.ResponseWriter, r *http.Request, orderID uint) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	var orden models.Orden
	if err := h.db.WithContext(r.Context()).First(&orden, orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeJSONError(w, http.StatusNotFound, "orden no encontrada")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "error al buscar la orden")
		return
	}

	if orden.IDUsuarioVendedor != userID {
		writeJSONError(w, http.StatusForbidden, "solo el vendedor puede marcar el servicio como entregado")
		return
	}
	if orden.Estado != models.EstadoOrdenAceptada {
		writeJSONError(w, http.StatusConflict, "solo se puede marcar entrega cuando la orden está ACEPTADA")
		return
	}

	now := time.Now().UTC()
	extra := models.OrderExtra{
		IDOrden:                 orderID,
		VendedorConfirmoEntrega: true,
		FechaEntregaVendedor:    &now,
	}
	if err := h.db.WithContext(r.Context()).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id_orden"}},
		DoUpdates: clause.AssignmentColumns([]string{"vendedor_confirmo_entrega", "fecha_entrega_vendedor", "fecha_actualizacion"}),
	}).Create(&extra).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al registrar confirmación de entrega")
		return
	}

	var updated models.OrderExtra
	_ = h.db.WithContext(r.Context()).First(&updated, orderID).Error
	if updated.IDOrden == 0 {
		updated = extra
	}
	writeJSON(w, http.StatusOK, map[string]any{"extra": updated})
}

func (h *ExtensionsHandler) handleCreateReview(w http.ResponseWriter, r *http.Request, orderID uint) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	var req struct {
		Rating     int    `json:"rating"`
		Comentario string `json:"comentario"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "cuerpo JSON inválido")
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		writeJSONError(w, http.StatusBadRequest, "la calificación debe estar entre 1 y 5 estrellas")
		return
	}
	comentario := strings.TrimSpace(req.Comentario)
	if utf8.RuneCountInString(comentario) > maxReviewCommentRunes {
		writeJSONError(w, http.StatusBadRequest, "el comentario no puede superar los 500 caracteres")
		return
	}

	var orden models.Orden
	if err := h.db.WithContext(r.Context()).First(&orden, orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeJSONError(w, http.StatusNotFound, "orden no encontrada")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "error al buscar la orden")
		return
	}

	if orden.IDUsuarioComprador != userID {
		writeJSONError(w, http.StatusForbidden, "solo el comprador puede calificar esta orden")
		return
	}
	if orden.Estado != models.EstadoOrdenCompletada {
		writeJSONError(w, http.StatusConflict, "solo puedes calificar una orden COMPLETADA")
		return
	}

	var existing int64
	if err := h.db.WithContext(r.Context()).
		Model(&models.OrderReview{}).
		Where("id_orden = ?", orderID).
		Count(&existing).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al verificar reseña existente")
		return
	}
	if existing > 0 {
		writeJSONError(w, http.StatusConflict, "esta orden ya fue calificada")
		return
	}

	review := models.OrderReview{
		IDOrden:           orden.IDOrden,
		IDPublicacion:     orden.IDPublicacion,
		IDUsuarioAutor:    orden.IDUsuarioComprador,
		IDUsuarioEvaluado: orden.IDUsuarioVendedor,
		Rating:            req.Rating,
		Comentario:        comentario,
	}
	if err := h.db.WithContext(r.Context()).Create(&review).Error; err != nil {
		writeJSONError(w, http.StatusConflict, "no se pudo guardar la calificación")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"review": review})
}

func (h *ExtensionsHandler) handleGetUserReviews(w http.ResponseWriter, r *http.Request) {
	rawID := strings.TrimPrefix(r.URL.Path, "/v1/reviews/user/")
	rawID = strings.TrimSuffix(rawID, "/")
	targetUserID, err := parsePositiveUint(rawID)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "identificador de usuario inválido")
		return
	}

	var reviews []models.OrderReview
	if err := h.db.WithContext(r.Context()).
		Where("id_usuario_evaluado = ?", targetUserID).
		Order("fecha_creacion DESC, id_review DESC").
		Limit(50).
		Find(&reviews).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al consultar reseñas del usuario")
		return
	}

	var sum int
	for _, rev := range reviews {
		sum += rev.Rating
	}
	avg := 0.0
	if len(reviews) > 0 {
		avg = math.Round((float64(sum)/float64(len(reviews)))*10) / 10
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"userId":       targetUserID,
		"averageScore": avg,
		"totalReviews": len(reviews),
		"reviews":      reviews,
	})
}

func (h *ExtensionsHandler) handlePendingSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "usuario no autenticado")
		return
	}

	var pendingSales int64
	if err := h.db.WithContext(r.Context()).
		Model(&models.Orden{}).
		Where("id_usuario_vendedor = ? AND estado = ?", userID, models.EstadoOrdenPendiente).
		Count(&pendingSales).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al consultar ventas pendientes")
		return
	}

	var deliveredAwaitingBuyer int64
	if err := h.db.WithContext(r.Context()).
		Table("ordenes o").
		Joins("JOIN order_extras e ON e.id_orden = o.id_orden").
		Where("o.deleted_at IS NULL AND o.id_usuario_comprador = ? AND o.estado = ? AND e.vendedor_confirmo_entrega = ?",
			userID, models.EstadoOrdenAceptada, true).
		Count(&deliveredAwaitingBuyer).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "error al consultar entregas por confirmar")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"pendingSalesCount":           pendingSales,
		"deliveredAwaitingBuyerCount": deliveredAwaitingBuyer,
	})
}

func userIDFromContext(r *http.Request) (uint, bool) {
	raw := r.Context().Value(middleware.UserIDKey)
	uid, ok := raw.(uint)
	return uid, ok && uid > 0
}

func parsePositiveUint(raw string) (uint, error) {
	if raw == "" {
		return 0, errors.New("empty")
	}
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || v == 0 {
		return 0, errors.New("invalid")
	}
	return uint(v), nil
}

func writeJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(body)
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]string{"error": message})
}

