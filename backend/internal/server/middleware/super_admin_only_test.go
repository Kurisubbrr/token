package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSuperAdminOnlyRoleBoundary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tt := range []struct {
		role   string
		status int
	}{
		{role: service.RoleSuperAdmin, status: http.StatusOK},
		{role: service.RoleAdmin, status: http.StatusForbidden},
		{role: service.RoleUser, status: http.StatusForbidden},
		{status: http.StatusUnauthorized},
	} {
		t.Run(tt.role, func(t *testing.T) {
			router := gin.New()
			router.Use(func(c *gin.Context) {
				if tt.role != "" {
					c.Set(string(ContextKeyUserRole), tt.role)
				}
			})
			router.Use(SuperAdminOnly())
			router.GET("/settings/admin-api-key", func(c *gin.Context) { c.Status(http.StatusOK) })
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/settings/admin-api-key", nil))
			require.Equal(t, tt.status, rec.Code)
			if tt.status == http.StatusForbidden {
				require.Contains(t, rec.Body.String(), "SUPER_ADMIN_REQUIRED")
			}
		})
	}
}

func TestSuperAdminWriteOnlyPreservesMonitoringReadAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set(string(ContextKeyUserRole), service.RoleAdmin) })
	router.Use(SuperAdminWriteOnly())
	router.GET("/settings", func(c *gin.Context) { c.Status(http.StatusOK) })
	router.PUT("/settings", func(c *gin.Context) { c.Status(http.StatusOK) })
	for _, tt := range []struct {
		method string
		status int
	}{
		{http.MethodGet, http.StatusOK}, {http.MethodPut, http.StatusForbidden},
	} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(tt.method, "/settings", nil))
		require.Equal(t, tt.status, rec.Code)
	}
}
