package antigravity

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

const testOAuthClientID = "antigravity-test-client-id"

type oauthConfigTransport func(*http.Request) (*http.Response, error)

func (f oauthConfigTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestOAuthCredentialsMissingBeforeAuthorizationOrTokenRequests(t *testing.T) {
	for _, test := range []struct {
		name, clientID, secret, missingEnv string
	}{
		{"missing_id", "", "fake-secret", AntigravityOAuthClientIDEnv},
		{"blank_id", "   ", "fake-secret", AntigravityOAuthClientIDEnv},
		{"missing_secret", testOAuthClientID, "", AntigravityOAuthClientSecretEnv},
		{"blank_secret", testOAuthClientID, "   ", AntigravityOAuthClientSecretEnv},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv(AntigravityOAuthClientIDEnv, test.clientID)
			t.Setenv(AntigravityOAuthClientSecretEnv, test.secret)
			authURL, err := BuildAuthorizationURL("state", "challenge")
			require.ErrorContains(t, err, test.missingEnv)
			require.Empty(t, authURL)
			requests := 0
			client := &Client{httpClient: &http.Client{Transport: oauthConfigTransport(func(*http.Request) (*http.Response, error) {
				requests++
				return nil, nil
			})}}
			_, err = client.ExchangeCode(context.Background(), "fake-code", "verifier")
			require.ErrorContains(t, err, test.missingEnv)
			_, err = client.RefreshToken(context.Background(), "fake-refresh")
			require.ErrorContains(t, err, test.missingEnv)
			require.Zero(t, requests, "missing configuration must not send credentials upstream")
		})
	}
}

func TestOAuthCredentialsUseConfiguredValues(t *testing.T) {
	t.Setenv(AntigravityOAuthClientIDEnv, "  "+testOAuthClientID+"  ")
	t.Setenv(AntigravityOAuthClientSecretEnv, "  fake-secret  ")
	authURL, err := BuildAuthorizationURL("state", "challenge")
	require.NoError(t, err)
	parsed, err := url.Parse(authURL)
	require.NoError(t, err)
	require.Equal(t, testOAuthClientID, parsed.Query().Get("client_id"))
	require.Empty(t, parsed.Query().Get("client_secret"))

	var grants []string
	client := &Client{httpClient: &http.Client{Transport: oauthConfigTransport(func(r *http.Request) (*http.Response, error) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, testOAuthClientID, r.Form.Get("client_id"))
		require.Equal(t, "fake-secret", r.Form.Get("client_secret"))
		grants = append(grants, r.Form.Get("grant_type"))
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"access_token":"fake-access","expires_in":3600}`))}, nil
	})}}
	_, err = client.ExchangeCode(context.Background(), "fake-code", "verifier")
	require.NoError(t, err)
	_, err = client.RefreshToken(context.Background(), "fake-refresh")
	require.NoError(t, err)
	require.Equal(t, []string{"authorization_code", "refresh_token"}, grants)
}
