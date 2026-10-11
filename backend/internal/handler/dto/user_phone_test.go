package dto

import (
	"testing"

	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/stretchr/testify/require"
)

func TestUserFromService_PhonePlaceholderHidden(t *testing.T) {
	user := &service.User{ID: 7, Phone: "13800138000", Email: "phone-13800138000@phone-connect.invalid", Role: service.RoleUser}
	for _, mapped := range []*User{UserFromServiceShallow(user), UserFromService(user), &UserFromServiceAdmin(user).User} {
		require.Equal(t, user.Phone, mapped.Phone)
		require.Empty(t, mapped.Email)
	}
	user.Email = "bound@example.com"
	require.Equal(t, "bound@example.com", UserFromService(user).Email)
}
