//go:build unit

package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPhoneRegistrationCannotSkipCaptchaWithEmailCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{}
	settings := service.NewSettingService(&oauthCaptchaSettingRepo{values: map[string]string{
		service.SettingKeyRegistrationEnabled: "false",
		service.SettingKeyEmailVerifyEnabled:  "true",
		service.SettingKeyTurnstileEnabled:    "true",
		service.SettingKeyTurnstileSecretKey:  "secret",
	}}, cfg)
	auth := service.NewAuthService(nil, nil, nil, nil, cfg, settings, nil, nil, nil, nil, nil, nil, nil)
	handler := &AuthHandler{authService: auth}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(`{"phone":"13800138000","password":"secret-123","verify_code":"forged-email-code"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	handler.Register(c)
	// Missing captcha provider is rejected before registration; forged email code cannot exempt phone requests.
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Contains(t, recorder.Body.String(), "TURNSTILE_NOT_CONFIGURED")
}

func TestPhoneAuthRequestsRejectAmbiguousOrMissingIdentifiers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, payload := range []string{
		`{"password":"secret-123"}`,
		`{"email":"user@example.com","phone":"13800138000","password":"secret-123"}`,
		`{"phone":"123456","password":"secret-123"}`,
	} {
		for _, action := range []string{"register", "login"} {
			t.Run(action+payload, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/"+action, strings.NewReader(payload))
				c.Request.Header.Set("Content-Type", "application/json")
				handler := &AuthHandler{}
				if action == "register" {
					handler.Register(c)
				} else {
					handler.Login(c)
				}
				require.Equal(t, http.StatusBadRequest, recorder.Code)
			})
		}
	}
}
