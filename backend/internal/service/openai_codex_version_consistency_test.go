//go:build unit

package service

import (
	"strings"
	"testing"

	"github.com/bhr2625556394-alt/token/internal/pkg/openai"
	"github.com/stretchr/testify/require"
)

func TestCodexVersionConstants_Consistency(t *testing.T) {
	require.True(t, strings.Contains(codexCLIUserAgent, openai.CodexDefaultOriginator+"/"+codexCLIVersion),
		"codexCLIUserAgent must embed codexCLIVersion")

	require.True(t, strings.Contains(DefaultOpenAICodexUserAgent, codexCLIVersion),
		"DefaultOpenAICodexUserAgent must embed codexCLIVersion")
}
