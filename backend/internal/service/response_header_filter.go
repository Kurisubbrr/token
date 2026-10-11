package service

import (
	"github.com/bhr2625556394-alt/token/internal/config"
	"github.com/bhr2625556394-alt/token/internal/util/responseheaders"
)

func compileResponseHeaderFilter(cfg *config.Config) *responseheaders.CompiledHeaderFilter {
	if cfg == nil {
		return nil
	}
	return responseheaders.CompileHeaderFilter(cfg.Security.ResponseHeaders)
}
