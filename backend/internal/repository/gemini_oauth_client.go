package repository

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/pkg/geminicli"
	"github.com/bhr2625556394-alt/token/internal/service"

	"github.com/imroc/req/v3"
)

type geminiOAuthClient struct {
	tokenURL string
	cfg      *config.Config
}

func NewGeminiOAuthClient(cfg *config.Config) service.GeminiOAuthClient {
	return &geminiOAuthClient{
		tokenURL: geminicli.TokenURL,
		cfg:      cfg,
	}
}

func (c *geminiOAuthClient) ExchangeCode(ctx context.Context, oauthType, code, codeVerifier, redirectURI, proxyURL string) (*geminicli.TokenResponse, error) {
	// Use different OAuth clients based on oauthType:
	// - code_assist: always use environment-configured Gemini CLI OAuth client
	// - google_one: always use environment-configured Gemini CLI OAuth client
	// - ai_studio: requires a user-provided OAuth client
	oauthCfgInput := geminicli.OAuthConfig{
		ClientID:     c.cfg.Gemini.OAuth.ClientID,
		ClientSecret: c.cfg.Gemini.OAuth.ClientSecret,
		Scopes:       c.cfg.Gemini.OAuth.Scopes,
	}
	if oauthType == "code_assist" || oauthType == "google_one" {
		// Force use of configured Gemini CLI OAuth client
		oauthCfgInput.ClientID = ""
		oauthCfgInput.ClientSecret = ""
	}

	oauthCfg, err := geminicli.EffectiveOAuthConfig(oauthCfgInput, oauthType)
	if err != nil {
		return nil, err
	}

	client, err := createGeminiReqClient(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("create HTTP client: %w", err)
	}

	formData := url.Values{}
	formData.Set("grant_type", "authorization_code")
	formData.Set("client_id", oauthCfg.ClientID)
	formData.Set("client_secret", oauthCfg.ClientSecret)
	formData.Set("code", code)
	formData.Set("code_verifier", codeVerifier)
	formData.Set("redirect_uri", redirectURI)

	var tokenResp geminicli.TokenResponse
	resp, err := client.R().
		SetContext(ctx).
		SetFormDataFromValues(formData).
		SetSuccessResult(&tokenResp).
		Post(c.tokenURL)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if !resp.IsSuccessState() {
		return nil, fmt.Errorf("token exchange failed: status %d, body: %s", resp.StatusCode, geminicli.SanitizeBodyForLogs(resp.String()))
	}
	return &tokenResp, nil
}

func (c *geminiOAuthClient) RefreshToken(ctx context.Context, oauthType, refreshToken, proxyURL string) (*geminicli.TokenResponse, error) {
	oauthCfgInput := geminicli.OAuthConfig{
		ClientID:     c.cfg.Gemini.OAuth.ClientID,
		ClientSecret: c.cfg.Gemini.OAuth.ClientSecret,
		Scopes:       c.cfg.Gemini.OAuth.Scopes,
	}
	if oauthType == "code_assist" || oauthType == "google_one" {
		// Force use of configured Gemini CLI OAuth client
		oauthCfgInput.ClientID = ""
		oauthCfgInput.ClientSecret = ""
	}

	oauthCfg, err := geminicli.EffectiveOAuthConfig(oauthCfgInput, oauthType)
	if err != nil {
		return nil, err
	}

	client, err := createGeminiReqClient(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("create HTTP client: %w", err)
	}

	formData := url.Values{}
	formData.Set("grant_type", "refresh_token")
	formData.Set("refresh_token", refreshToken)
	formData.Set("client_id", oauthCfg.ClientID)
	formData.Set("client_secret", oauthCfg.ClientSecret)

	var tokenResp geminicli.TokenResponse
	resp, err := client.R().
		SetContext(ctx).
		SetFormDataFromValues(formData).
		SetSuccessResult(&tokenResp).
		Post(c.tokenURL)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if !resp.IsSuccessState() {
		return nil, fmt.Errorf("token refresh failed: status %d, body: %s", resp.StatusCode, geminicli.SanitizeBodyForLogs(resp.String()))
	}
	return &tokenResp, nil
}

func createGeminiReqClient(proxyURL string) (*req.Client, error) {
	return getSharedReqClient(reqClientOptions{
		ProxyURL: proxyURL,
		Timeout:  60 * time.Second,
	})
}
