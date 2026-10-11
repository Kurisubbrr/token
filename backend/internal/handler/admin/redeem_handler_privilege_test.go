package admin

import (
	"net/http"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/server/middleware"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreateAndRedeemOrdinaryAdminCannotModifyHigherPrivilegeBalance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, role := range []string{service.RoleAdmin, service.RoleSuperAdmin} {
		t.Run(role, func(t *testing.T) {
			adminSvc := newStubAdminService()
			adminSvc.users = append(adminSvc.users, service.User{ID: 2, Role: role, Status: service.StatusActive})
			h := NewRedeemHandler(adminSvc, &service.RedeemService{})
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set(string(middleware.ContextKeyUserRole), service.RoleAdmin)
				c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 9})
			})
			router.POST("/redeem-codes/create-and-redeem", h.CreateAndRedeem)
			rec := doJSON(t, router, http.MethodPost, "/redeem-codes/create-and-redeem", map[string]any{
				"code": "private-recharge", "user_id": 2, "value": 100,
			})
			require.Equal(t, http.StatusForbidden, rec.Code)
			require.Len(t, adminSvc.redeems, 1, "authorization must run before creating or redeeming a code")
		})
	}
}
