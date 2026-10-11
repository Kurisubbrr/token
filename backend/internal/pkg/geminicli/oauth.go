package geminicli

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	infraerrors "github.com/bhr2625556394-alt/token/internal/pkg/errors"
)

type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	Scopes       string
}

type OAuthSession struct {
	State        string `json:"state"`
	CodeVerifier string `json:"code_verifier"`
	ProxyURL     string `json:"proxy_url,omitempty"`
	RedirectURI  string `json:"redirect_uri"`
	ProjectID    string `json:"project_id,omitempty"`
	// TierID is a user-selected fallback tier.
	// For oauth types that support auto detection (google_one/code_assist), the server will prefer
	// the detected tier and fall back to TierID when detection fails.
	TierID    string    `json:"tier_id,omitempty"`
	OAuthType string    `json:"oauth_type"` // "code_assist" 或 "ai_studio"
	CreatedAt time.Time `json:"created_at"`
}

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*OAuthSession
	stopCh   chan struct{}
}

func NewSessionStore() *SessionStore {
	store := &SessionStore{
		sessions: make(map[string]*OAuthSession),
		stopCh:   make(chan struct{}),
	}
	go store.cleanup()
	return store
}

func (s *SessionStore) Set(sessionID string, session *OAuthSession) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sessionID] = session
}

func (s *SessionStore) Get(sessionID string) (*OAuthSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[sessionID]
	if !ok {
		return nil, false
	}
	if time.Since(session.CreatedAt) > SessionTTL {
		return nil, false
	}
	return session, true
}

func (s *SessionStore) Delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

func (s *SessionStore) Stop() {
	select {
	case <-s.stopCh:
		return
	default:
		close(s.stopCh)
	}
}

func (s *SessionStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.mu.Lock()
			for id, session := range s.sessions {
				if time.Since(session.CreatedAt) > SessionTTL {
					delete(s.sessions, id)
				}
			}
			s.mu.Unlock()
		}
	}
}

func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func GenerateState() (string, error) {
	bytes, err := GenerateRandomBytes(32)
	if err != nil {
		return "", err
	}
	return base64URLEncode(bytes), nil
}

func GenerateSessionID() (string, error) {
	bytes, err := GenerateRandomBytes(16)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateCodeVerifier returns an RFC 7636 compatible code verifier (43+ chars).
func GenerateCodeVerifier() (string, error) {
	bytes, err := GenerateRandomBytes(32)
	if err != nil {
		return "", err
	}
	return base64URLEncode(bytes), nil
}

func GenerateCodeChallenge(verifier string) string {
	hash := sha256.Sum256([]byte(verifier))
	return base64URLEncode(hash[:])
}

func base64URLEncode(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

// EffectiveOAuthConfig returns the effective OAuth configuration.
// oauthType: "code_assist" or "ai_studio" (defaults to "code_assist" if empty).
//
// If ClientID/ClientSecret is not provided, this falls back to the environment-configured Gemini CLI OAuth client.
//
// Note: The configured OAuth client may reject unsupported scopes (e.g.
// https://www.googleapis.com/auth/generative-language), which will surface as
// "restricted_client" / "Unregistered scope(s)" errors during browser authorization.
func EffectiveOAuthConfig(cfg OAuthConfig, oauthType string) (OAuthConfig, error) {
	effective := OAuthConfig{
		ClientID:     strings.TrimSpace(cfg.ClientID),
		ClientSecret: strings.TrimSpace(cfg.ClientSecret),
		Scopes:       strings.TrimSpace(cfg.Scopes),
	}

	// Normalize scopes: allow comma-separated input but send space-delimited scopes to Google.
	if effective.Scopes != "" {
		effective.Scopes = strings.Join(strings.Fields(strings.ReplaceAll(effective.Scopes, ",", " ")), " ")
	}

	// Use the operator-provided Gemini CLI credentials only when no custom pair is set.
	// Do not mix a partial custom configuration with environment credentials.
	if effective.ClientID == "" && effective.ClientSecret == "" {
		effective.ClientID = strings.TrimSpace(os.Getenv(GeminiCLIOAuthClientIDEnv))
		effective.ClientSecret = strings.TrimSpace(os.Getenv(GeminiCLIOAuthClientSecretEnv))
		if effective.ClientID == "" || effective.ClientSecret == "" {
			return OAuthConfig{}, infraerrors.Newf(http.StatusBadRequest, "GEMINI_CLI_OAUTH_CLIENT_NOT_CONFIGURED", "Gemini CLI OAuth client not configured: set both %s and %s", GeminiCLIOAuthClientIDEnv, GeminiCLIOAuthClientSecretEnv)
		}
	} else if effective.ClientID == "" || effective.ClientSecret == "" {
		return OAuthConfig{}, infraerrors.New(http.StatusBadRequest, "GEMINI_OAUTH_CLIENT_NOT_CONFIGURED", "OAuth client not configured: set both client_id and client_secret (GEMINI_OAUTH_CLIENT_ID / GEMINI_OAUTH_CLIENT_SECRET), or leave both empty and configure GEMINI_CLI_OAUTH_CLIENT_ID / GEMINI_CLI_OAUTH_CLIENT_SECRET")
	}

	isCLIClient := IsGeminiCLIClient(effective.ClientID)

	if effective.Scopes == "" {
		// Use different default scopes based on OAuth type
		switch oauthType {
		case "ai_studio":
			// Keep the CLI flow within its existing Code Assist scope set.
			if isCLIClient {
				effective.Scopes = DefaultCodeAssistScopes
			} else {
				effective.Scopes = DefaultAIStudioScopes
			}
		case "google_one":
			// Google One uses the configured Gemini CLI client (same as code_assist)
			// Preserve the existing scope set for the CLI authorization flow.
			effective.Scopes = DefaultCodeAssistScopes
		default:
			// Default to Code Assist scopes
			effective.Scopes = DefaultCodeAssistScopes
		}
	} else if (oauthType == "ai_studio" || oauthType == "google_one") && isCLIClient {
		// If user overrides scopes while still using the Gemini CLI client, strip restricted scopes.
		parts := strings.Fields(effective.Scopes)
		filtered := make([]string, 0, len(parts))
		for _, s := range parts {
			if hasRestrictedScope(s) {
				continue
			}
			filtered = append(filtered, s)
		}
		if len(filtered) == 0 {
			effective.Scopes = DefaultCodeAssistScopes
		} else {
			effective.Scopes = strings.Join(filtered, " ")
		}
	}

	// Backward compatibility: normalize older AI Studio scope to the currently documented one.
	if oauthType == "ai_studio" && effective.Scopes != "" {
		parts := strings.Fields(effective.Scopes)
		for i := range parts {
			if parts[i] == "https://www.googleapis.com/auth/generative-language" {
				parts[i] = "https://www.googleapis.com/auth/generative-language.retriever"
			}
		}
		effective.Scopes = strings.Join(parts, " ")
	}

	return effective, nil
}

// IsGeminiCLIClient reports whether clientID matches the operator-configured CLI client.
// An absent environment setting must never identify an empty custom client as CLI.
func IsGeminiCLIClient(clientID string) bool {
	cliClientID := strings.TrimSpace(os.Getenv(GeminiCLIOAuthClientIDEnv))
	return cliClientID != "" && strings.TrimSpace(clientID) == cliClientID
}

func hasRestrictedScope(scope string) bool {
	return strings.HasPrefix(scope, "https://www.googleapis.com/auth/generative-language") ||
		strings.HasPrefix(scope, "https://www.googleapis.com/auth/drive")
}

func BuildAuthorizationURL(cfg OAuthConfig, state, codeChallenge, redirectURI, projectID, oauthType string) (string, error) {
	effectiveCfg, err := EffectiveOAuthConfig(cfg, oauthType)
	if err != nil {
		return "", err
	}
	redirectURI = strings.TrimSpace(redirectURI)
	if redirectURI == "" {
		return "", fmt.Errorf("redirect_uri is required")
	}

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", effectiveCfg.ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", effectiveCfg.Scopes)
	params.Set("state", state)
	params.Set("code_challenge", codeChallenge)
	params.Set("code_challenge_method", "S256")
	params.Set("access_type", "offline")
	params.Set("prompt", "consent")
	params.Set("include_granted_scopes", "true")
	if strings.TrimSpace(projectID) != "" {
		params.Set("project_id", strings.TrimSpace(projectID))
	}

	return fmt.Sprintf("%s?%s", AuthorizeURL, params.Encode()), nil
}
