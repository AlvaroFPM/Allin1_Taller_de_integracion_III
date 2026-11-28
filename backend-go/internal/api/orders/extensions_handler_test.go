package orders

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWrapHandler_DelegatesStandardOrdersRoutesToGateway(t *testing.T) {
	handler := NewExtensionsHandler(nil)
	delegated := false
	gateway := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		delegated = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/orders/mis-compras", nil)
	rec := httptest.NewRecorder()
	handler.WrapHandler(gateway).ServeHTTP(rec, req)

	if !delegated {
		t.Fatalf("se esperaba delegar /v1/orders/mis-compras al gateway")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("se esperaba 200, se obtuvo %d", rec.Code)
	}
}

func TestWrapHandler_RequiresAuthOnProtectedExtensionRoutes(t *testing.T) {
	handler := NewExtensionsHandler(nil)
	gateway := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("no debería delegar ruta de extensión al gateway: %s %s", r.Method, r.URL.Path)
	})
	wrapped := handler.WrapHandler(gateway)

	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/v1/orders/extras?ids=1", ""},
		{http.MethodGet, "/v1/orders/pending-summary", ""},
		{http.MethodPut, "/v1/orders/12/extras", `{"notas":"hola"}`},
		{http.MethodPost, "/v1/orders/12/deliver", `{}`},
		{http.MethodPost, "/v1/orders/12/review", `{"rating":5}`},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s sin token: esperado 401, obtenido %d", tc.method, tc.path, rec.Code)
		}
	}
}

func TestGetUserReviews_RejectsInvalidUserID(t *testing.T) {
	handler := NewExtensionsHandler(nil)
	wrapped := handler.WrapHandler(http.NotFoundHandler())

	for _, path := range []string{"/v1/reviews/user/0", "/v1/reviews/user/abc", "/v1/reviews/user/"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("GET %s: esperado 400, obtenido %d", path, rec.Code)
		}
	}
}

func TestParsePositiveUint(t *testing.T) {
	if got, err := parsePositiveUint("42"); err != nil || got != 42 {
		t.Fatalf("esperado 42, obtenido %d (err=%v)", got, err)
	}
	for _, invalid := range []string{"", "0", "-1", "abc", strings.Repeat("9", 30)} {
		if _, err := parsePositiveUint(invalid); err == nil {
			t.Errorf("parsePositiveUint(%q) debería fallar", invalid)
		}
	}
}

