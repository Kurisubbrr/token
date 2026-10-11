package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/server/middleware"
	"github.com/bhr2625556394-alt/token/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 角色提升为管理员的 step-up 门控条件测试。
// 测试环境不注入认证上下文，因此门控一旦触发会以 401 中止；
// 借此区分「触发了 step-up 校验」与「直接放行到业务层（200）」。
func setupRoleStepUpRouter(t *testing.T) (*gin.Engine, *stubAdminService) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	adminSvc := newStubAdminService()
	// 追加一个已是管理员的目标用户，验证「目标已是 admin 不触发门控」。
	adminSvc.users = append(adminSvc.users, service.User{
		ID:     2,
		Email:  "admin@example.com",
		Role:   service.RoleAdmin,
		Status: service.StatusActive,
	})

	h := NewUserHandler(adminSvc, nil, nil, nil, nil, nil, nil)
	// Mark this fixture as the owner so role authorization and step-up can be
	// verified independently. Missing auth subject still makes step-up return 401.
	router.Use(func(c *gin.Context) { c.Set(string(middleware.ContextKeyUserRole), service.RoleSuperAdmin) })
	router.POST("/api/v1/admin/users", h.Create)
	router.PUT("/api/v1/admin/users/:id", h.Update)
	return router, adminSvc
}

func doJSON(t *testing.T, router *gin.Engine, method, path string, payload map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	return rec
}

func TestUpdateUserPromoteToAdminRequiresStepUp(t *testing.T) {
	router, _ := setupRoleStepUpRouter(t)

	rec := doJSON(t, router, http.MethodPut, "/api/v1/admin/users/1", map[string]any{"role": "admin"})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestUpdateUserKeepAdminRoleSkipsStepUp(t *testing.T) {
	router, _ := setupRoleStepUpRouter(t)

	rec := doJSON(t, router, http.MethodPut, "/api/v1/admin/users/2", map[string]any{"role": "admin"})
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestUpdateUserRegularRoleSkipsStepUp(t *testing.T) {
	router, _ := setupRoleStepUpRouter(t)

	rec := doJSON(t, router, http.MethodPut, "/api/v1/admin/users/1", map[string]any{"role": "user", "email": "u@example.com"})
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestCreateAdminUserRequiresStepUp(t *testing.T) {
	router, _ := setupRoleStepUpRouter(t)

	rec := doJSON(t, router, http.MethodPost, "/api/v1/admin/users", map[string]any{
		"email": "new-admin@example.com", "password": "pass123", "role": "admin",
	})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestCreateRegularUserSkipsStepUp(t *testing.T) {
	router, _ := setupRoleStepUpRouter(t)

	rec := doJSON(t, router, http.MethodPost, "/api/v1/admin/users", map[string]any{
		"email": "new-user@example.com", "password": "pass123", "role": "user",
	})
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestOrdinaryAdminRoleChangesReturnForbiddenBeforeStepUp(t *testing.T) {
	for _, tt := range []struct{ method, path, role string }{
		{http.MethodPost, "/api/v1/admin/users", service.RoleAdmin},
		{http.MethodPut, "/api/v1/admin/users/1", service.RoleAdmin},
		{http.MethodPut, "/api/v1/admin/users/2", service.RoleUser},
	} {
		router, _ := setupRoleStepUpRouter(t)
		// Gin executes router middleware in registration order, so a new route
		// group overrides the fixture role before invoking the real handlers.
		adminSvc := newStubAdminService()
		adminSvc.users = append(adminSvc.users, service.User{ID: 2, Role: service.RoleAdmin, Status: service.StatusActive})
		h := NewUserHandler(adminSvc, nil, nil, nil, nil, nil, nil)
		group := router.Group("/ordinary", func(c *gin.Context) { c.Set(string(middleware.ContextKeyUserRole), service.RoleAdmin) })
		group.POST("/api/v1/admin/users", h.Create)
		group.PUT("/api/v1/admin/users/:id", h.Update)
		rec := doJSON(t, router, tt.method, "/ordinary"+tt.path, map[string]any{
			"email": "user@example.com", "password": "pass123", "role": tt.role,
		})
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Contains(t, rec.Body.String(), "SUPER_ADMIN_REQUIRED")
	}
}

func TestAdministratorMutationGuardProtectsHigherPrivilegeUsers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adminSvc := newStubAdminService()
	adminSvc.users = append(adminSvc.users, service.User{ID: 2, Role: service.RoleSuperAdmin, Status: service.StatusActive})
	h := NewUserHandler(adminSvc, nil, nil, nil, nil, nil, nil)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyUserRole), service.RoleAdmin)
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 9})
	})
	router.Use(h.ProtectAdministratorAccounts())
	router.POST("/users/:id/balance", func(c *gin.Context) { c.Status(http.StatusOK) })
	for _, tt := range []struct {
		path   string
		status int
	}{
		{"/users/1/balance", http.StatusOK}, {"/users/2/balance", http.StatusForbidden},
	} {
		rec := doJSON(t, router, http.MethodPost, tt.path, map[string]any{"balance": 100, "operation": "add"})
		require.Equal(t, tt.status, rec.Code)
	}
}
