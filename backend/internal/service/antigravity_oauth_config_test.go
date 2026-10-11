package service

import (
	"context"
	"net/url"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/pkg/antigravity"
	"github.com/stretchr/testify/require"
)

func TestAntigravityOAuthStartRequiresConfiguredCredentials(t *testing.T) {
	svc := NewAntigravityOAuthService(nil)
	defer svc.Stop()
	t.Setenv(antigravity.AntigravityOAuthClientIDEnv, "")
	t.Setenv(antigravity.AntigravityOAuthClientSecretEnv, "")
	result, err := svc.GenerateAuthURL(context.Background(), nil)
	require.ErrorContains(t, err, antigravity.AntigravityOAuthClientIDEnv)
	require.Nil(t, result)

	t.Setenv(antigravity.AntigravityOAuthClientIDEnv, "fake-antigravity-client")
	result, err = svc.GenerateAuthURL(context.Background(), nil)
	require.ErrorContains(t, err, antigravity.AntigravityOAuthClientSecretEnv)
	require.Nil(t, result)

	t.Setenv(antigravity.AntigravityOAuthClientSecretEnv, "fake-secret")
	result, err = svc.GenerateAuthURL(context.Background(), nil)
	require.NoError(t, err)
	parsed, err := url.Parse(result.AuthURL)
	require.NoError(t, err)
	require.Equal(t, "fake-antigravity-client", parsed.Query().Get("client_id"))
	require.NotEmpty(t, result.SessionID)
}
