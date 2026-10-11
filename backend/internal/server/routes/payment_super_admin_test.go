package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/handler"
	"github.com/bhr2625556394-alt/token/internal/handler/admin"
	"github.com/bhr2625556394-alt/token/internal/server/middleware"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPaymentSecretRoutesRequireSuperAdministrator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	noop := func(c *gin.Context) { c.Next() }
	auth := middleware.AdminAuthMiddleware(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyUserRole), service.RoleAdmin)
		c.Next()
	})
	RegisterPaymentRoutes(router.Group("/api/v1"), &handler.PaymentHandler{}, &handler.PaymentWebhookHandler{}, &admin.PaymentHandler{},
		middleware.JWTAuthMiddleware(noop), auth, middleware.AuditLogMiddleware(noop), nil, nil, nil)
	for _, tt := range []struct{ method, path string }{
		{http.MethodGet, "/config"}, {http.MethodPut, "/config"},
		{http.MethodGet, "/providers"}, {http.MethodPost, "/providers"},
		{http.MethodPut, "/providers/1"}, {http.MethodDelete, "/providers/1"},
	} {
		t.Run(tt.method+tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(tt.method, "/api/v1/admin/payment"+tt.path, nil))
			require.Equal(t, http.StatusForbidden, rec.Code)
			require.Contains(t, rec.Body.String(), "SUPER_ADMIN_REQUIRED")
		})
	}
}
