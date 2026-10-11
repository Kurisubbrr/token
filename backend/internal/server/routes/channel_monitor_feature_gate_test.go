package routes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/handler"
	"github.com/bhr2625556394-alt/token/internal/server/middleware"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// channelMonitorRouteSettingRepoStub is a minimal SettingRepository for route guards.
type channelMonitorRouteSettingRepoStub struct {
	values map[string]string
}

func (s *channelMonitorRouteSettingRepoStub) Get(context.Context, string) (*service.Setting, error) {
	panic("unexpected Get call")
}

func (s *channelMonitorRouteSettingRepoStub) GetValue(_ context.Context, key string) (string, error) {
	return s.values[key], nil
}

func (s *channelMonitorRouteSettingRepoStub) Set(context.Context, string, string) error {
	panic("unexpected Set call")
}

func (s *channelMonitorRouteSettingRepoStub) GetMultiple(_ context.Context, keys []string) (map[string]string, error) {
	out := make(map[string]string, len(keys))
	for _, key := range keys {
		if value, ok := s.values[key]; ok {
			out[key] = value
		}
	}
	return out, nil
}

func (s *channelMonitorRouteSettingRepoStub) SetMultiple(context.Context, map[string]string) error {
	panic("unexpected SetMultiple call")
}

func (s *channelMonitorRouteSettingRepoStub) GetAll(context.Context) (map[string]string, error) {
	panic("unexpected GetAll call")
}

func (s *channelMonitorRouteSettingRepoStub) Delete(context.Context, string) error {
	panic("unexpected Delete call")
}

func newChannelMonitorRouteSettings(enabled bool) *service.SettingService {
	value := "false"
	if enabled {
		value = "true"
	}
	return service.NewSettingService(&channelMonitorRouteSettingRepoStub{
		values: map[string]string{
			service.SettingKeyChannelMonitorEnabled: value,
		},
	}, &config.Config{})
}

func newChannelMonitorModeSettings(enabled bool, mode string) *service.SettingService {
	enabledVal := "false"
	if enabled {
		enabledVal = "true"
	}
	return service.NewSettingService(&channelMonitorRouteSettingRepoStub{
		values: map[string]string{
			service.SettingKeyChannelMonitorEnabled: enabledVal,
			service.SettingKeyChannelMonitorMode:    mode,
		},
	}, &config.Config{})
}

func TestChannelMonitorAdminFeatureGuard(t *testing.T) {
	tests := []struct {
		name       string
		svc        *service.SettingService
		wantStatus int
	}{
		{
			name:       "nil setting service blocks",
			svc:        nil,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "disabled blocks",
			svc:        newChannelMonitorRouteSettings(false),
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "enabled allows",
			svc:        newChannelMonitorRouteSettings(true),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)

			router := gin.New()
			router.Use(channelMonitorAdminFeatureGuard(tt.svc))
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})

			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/test", nil)
			router.ServeHTTP(rec, req)

			require.Equal(t, tt.wantStatus, rec.Code)
			if tt.wantStatus == http.StatusForbidden {
				require.Contains(t, rec.Body.String(), "CHANNEL_MONITOR_DISABLED")
			}
		})
	}
}

func TestChannelMonitorModeV2Guard(t *testing.T) {
	tests := []struct {
		name       string
		svc        *service.SettingService
		wantStatus int
		wantCode   string
	}{
		{
			name:       "nil blocks as disabled",
			svc:        nil,
			wantStatus: http.StatusForbidden,
			wantCode:   "CHANNEL_MONITOR_DISABLED",
		},
		{
			name:       "feature off blocks",
			svc:        newChannelMonitorModeSettings(false, service.ChannelMonitorModeV2),
			wantStatus: http.StatusForbidden,
			wantCode:   "CHANNEL_MONITOR_DISABLED",
		},
		{
			name:       "mode v1 blocks with mode mismatch",
			svc:        newChannelMonitorModeSettings(true, service.ChannelMonitorModeV1),
			wantStatus: http.StatusForbidden,
			wantCode:   "CHANNEL_MONITOR_MODE_MISMATCH",
		},
		{
			name:       "mode v2 allows",
			svc:        newChannelMonitorModeSettings(true, service.ChannelMonitorModeV2),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.Use(channelMonitorModeV2Guard(tt.svc))
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})
			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/test", nil)
			router.ServeHTTP(rec, req)
			require.Equal(t, tt.wantStatus, rec.Code)
			if tt.wantCode != "" {
				require.Contains(t, rec.Body.String(), tt.wantCode)
			}
		})
	}
}

type channelMonitorRouteRepoStub struct {
	service.ChannelMonitorRepository
	listCalls int
}

func (s *channelMonitorRouteRepoStub) ListEnabled(context.Context) ([]*service.ChannelMonitor, error) {
	s.listCalls++
	return []*service.ChannelMonitor{}, nil
}

// Register the production routes rather than mounting AdminOnly directly, so
// this catches missing protection on either the legacy or V2 route group.
func newChannelMonitorRoleRouter(role string, mode string) (*gin.Engine, *channelMonitorRouteRepoStub) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	settings := newChannelMonitorModeSettings(true, mode)
	repo := &channelMonitorRouteRepoStub{}
	h := &handler.Handlers{
		ChannelMonitor:   handler.NewChannelMonitorUserHandler(service.NewChannelMonitorService(repo, nil), settings),
		ChannelMonitorV2: handler.NewChannelMonitorV2Handler(nil, nil),
		AvailableChannel: handler.NewAvailableChannelHandler(nil, nil, settings),
	}
	jwt := middleware.JWTAuthMiddleware(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 10})
		c.Set(string(middleware.ContextKeyUserRole), role)
		c.Next()
	})
	audit := middleware.AuditLogMiddleware(func(c *gin.Context) { c.Next() })
	RegisterUserRoutes(router.Group("/api/v1"), h, jwt, audit, settings, nil)
	return router, repo
}

func TestChannelMonitorRegisteredRoutesRequireAdministratorRole(t *testing.T) {
	endpoints := []struct {
		path        string
		mode        string
		adminStatus int
	}{
		{path: "/channel-monitors", mode: service.ChannelMonitorModeV1, adminStatus: http.StatusOK},
		// Invalid identifiers deliberately stop at the actual handler's input
		// validation after authorization; no database/service fixture is needed.
		{path: "/channel-monitors/invalid/status", mode: service.ChannelMonitorModeV1, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/dimensions?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/snapshot?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/models?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/matrix?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/errors?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
		{path: "/channel-monitor-v2/users?group_id=invalid", mode: service.ChannelMonitorModeV2, adminStatus: http.StatusBadRequest},
	}
	for _, role := range []string{service.RoleUser, service.RoleAdmin, service.RoleSuperAdmin} {
		for _, endpoint := range endpoints {
			t.Run(role+endpoint.path, func(t *testing.T) {
				router, repo := newChannelMonitorRoleRouter(role, endpoint.mode)
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1"+endpoint.path, nil))
				if role == service.RoleUser {
					require.Equal(t, http.StatusForbidden, rec.Code)
					require.Contains(t, rec.Body.String(), "Admin access required")
					require.Zero(t, repo.listCalls, "ordinary users must be rejected before reading monitoring data")
				} else {
					require.Equal(t, endpoint.adminStatus, rec.Code)
					if endpoint.path == "/channel-monitors" {
						require.Equal(t, 1, repo.listCalls, "both management roles must reach the monitoring handler")
					}
				}
			})
		}
	}
}

func TestChannelMonitorRestrictionsPreserveUserAvailableChannelsRoute(t *testing.T) {
	router, _ := newChannelMonitorRoleRouter(service.RoleUser, service.ChannelMonitorModeV2)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/channels/available", nil))
	require.Equal(t, http.StatusOK, rec.Code, "available channels remains a normal user endpoint")
}
