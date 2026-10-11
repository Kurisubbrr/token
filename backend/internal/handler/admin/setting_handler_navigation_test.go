package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestNavigationSettingsExposeOnlySafeFlags(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &settingHandlerRepoStub{values: map[string]string{
		service.SettingKeySMTPPassword:                 "smtp-private-password",
		service.SettingKeyAdminAPIKey:                  "private-owner-api-key",
		service.SettingKeyOpsRealtimeMonitoringEnabled: "false",
		service.SettingKeyOpsQueryModeDefault:          "auto",
		service.SettingKeyCustomMenuItems:              `[{"id":"help","label":"Help","url":"https://example.com","visibility":"admin"}]`,
	}}
	h := NewSettingHandler(service.NewSettingService(repo, &config.Config{}), nil, nil, nil, nil, nil, nil)
	router := gin.New()
	router.GET("/navigation-settings", h.GetNavigationSettings)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/navigation-settings", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	var envelope struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &envelope))
	require.Len(t, envelope.Data, 5)
	require.Contains(t, envelope.Data, "custom_menu_items")
	require.Equal(t, "false", string(envelope.Data["ops_realtime_monitoring_enabled"]))
	require.NotContains(t, rec.Body.String(), "smtp-private-password")
	require.NotContains(t, rec.Body.String(), "private-owner-api-key")
	require.NotContains(t, envelope.Data, "smtp_password")
	require.NotContains(t, envelope.Data, "admin_api_key")
}
