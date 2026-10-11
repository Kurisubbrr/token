//go:build unit

package repository

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/pkg/geminicli"
)

func TestGeminiOAuthClient_MissingCredentials(t *testing.T) {
	for _, credentials := range []struct{ name, id, secret string }{
		{name: "missing both"},
		{name: "missing id", secret: "test-cli-secret"},
		{name: "missing secret", id: "test-cli-client-id"},
	} {
		t.Run(credentials.name, func(t *testing.T) {
			t.Setenv(geminicli.GeminiCLIOAuthClientIDEnv, credentials.id)
			t.Setenv(geminicli.GeminiCLIOAuthClientSecretEnv, credentials.secret)
			for _, oauthType := range []string{"code_assist", "google_one"} {
				t.Run(oauthType, func(t *testing.T) {
					// Custom AI Studio credentials must not silently replace the CLI client.
					client := &geminiOAuthClient{tokenURL: "http://127.0.0.1:1", cfg: &config.Config{
						Gemini: config.GeminiConfig{OAuth: config.GeminiOAuthConfig{
							ClientID: "custom-client-id", ClientSecret: "custom-secret",
						}},
					}}
					// An invalid proxy also verifies configuration is checked before HTTP setup.
					_, exchangeErr := client.ExchangeCode(context.Background(), oauthType, "code", "verifier", "https://example.com/callback", "://invalid")
					_, refreshErr := client.RefreshToken(context.Background(), oauthType, "refresh-token", "://invalid")
					for _, err := range []error{exchangeErr, refreshErr} {
						if err == nil {
							t.Fatal("missing CLI credentials must prevent token requests")
						}
						for _, env := range []string{geminicli.GeminiCLIOAuthClientIDEnv, geminicli.GeminiCLIOAuthClientSecretEnv} {
							if !strings.Contains(err.Error(), env) {
								t.Fatalf("expected actionable missing setting %s: %v", env, err)
							}
						}
					}
				})
			}
		})
	}
}

func TestGeminiOAuthClient_CredentialSelection(t *testing.T) {
	for _, tt := range []struct {
		name, oauthType, cliID, cliSecret, wantID, wantSecret string
	}{
		{"code assist CLI", "code_assist", "test-cli-client-id", "test-cli-secret", "test-cli-client-id", "test-cli-secret"},
		{"google one CLI", "google_one", "test-cli-client-id", "test-cli-secret", "test-cli-client-id", "test-cli-secret"},
		{"AI Studio custom", "ai_studio", "", "", "custom-client-id", "custom-secret"},
		{"AI Studio custom with CLI configured", "ai_studio", "test-cli-client-id", "test-cli-secret", "custom-client-id", "custom-secret"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(geminicli.GeminiCLIOAuthClientIDEnv, tt.cliID)
			t.Setenv(geminicli.GeminiCLIOAuthClientSecretEnv, tt.cliSecret)
			forms := make(chan string, 2)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if err := r.ParseForm(); err != nil {
					t.Errorf("parse token request: %v", err)
				}
				if r.Form.Get("client_id") != tt.wantID || r.Form.Get("client_secret") != tt.wantSecret {
					t.Error("token request used the wrong OAuth credentials")
				}
				forms <- r.Form.Get("grant_type")
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprint(w, `{"access_token":"test-access-token","expires_in":3600,"token_type":"Bearer"}`)
			}))
			defer server.Close()
			client := &geminiOAuthClient{tokenURL: server.URL, cfg: &config.Config{
				Gemini: config.GeminiConfig{OAuth: config.GeminiOAuthConfig{
					ClientID: "custom-client-id", ClientSecret: "custom-secret",
				}},
			}}
			token, err := client.ExchangeCode(context.Background(), tt.oauthType, "code", "verifier", "https://example.com/callback", "")
			if err != nil || token.AccessToken != "test-access-token" {
				t.Fatalf("exchange failed: %v", err)
			}
			token, err = client.RefreshToken(context.Background(), tt.oauthType, "refresh-token", "")
			if err != nil || token.AccessToken != "test-access-token" {
				t.Fatalf("refresh failed: %v", err)
			}
			if grant := <-forms; grant != "authorization_code" {
				t.Fatalf("exchange used grant %q", grant)
			}
			if grant := <-forms; grant != "refresh_token" {
				t.Fatalf("refresh used grant %q", grant)
			}
		})
	}
}
