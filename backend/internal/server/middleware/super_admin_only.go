package middleware

import (
	"net/http"

	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
)

// SuperAdminOnly protects installation-wide credentials and system controls.
// AdminAuth must run first so the role comes from the persisted user record.
func SuperAdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !EnforceSuperAdmin(c) {
			return
		}
		c.Next()
	}
}

func EnforceSuperAdmin(c *gin.Context) bool {
	role, ok := GetUserRoleFromContext(c)
	if !ok {
		AbortWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authorization required")
		return false
	}
	if role != service.RoleSuperAdmin {
		AbortWithError(c, http.StatusForbidden, "SUPER_ADMIN_REQUIRED", "Super administrator access required")
		return false
	}
	return true
}

// SuperAdminWriteOnly preserves ordinary administrators' monitoring read access.
func SuperAdminWriteOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead && !EnforceSuperAdmin(c) {
			return
		}
		c.Next()
	}
}
