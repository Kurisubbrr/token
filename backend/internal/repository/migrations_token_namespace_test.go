package repository

import (
	"crypto/sha256"
	"encoding/hex"
	"github.com/bhr2625556394-alt/token/migrations"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestTokenMigrationChecksumsPreserveExistingDatabases(t *testing.T) {
	cases := map[string]string{
		"001_init.sql":                   "9ba0369779484625edcea7a7d1d4582397e31546db9149b05004990a3f16c630",
		"002_account_type_migration.sql": "aad3816e44f58ff007ea4df8092aae580f3f85180314c1deb1b1054b20892bbf",
		"003_subscription.sql":           "4642fcb1ccd7954b1d3eef8f795cfba2ce21431257346cc5a7568cde61a60b13",
		"038_ops_errors_resolution_retry_results_and_standardize_classification.sql": "4cc121d97c7f59e9def9397b7d0314d4dfbfe4cd831698359456dd49bf995ece",
		"052_migrate_upstream_to_apikey.sql":                                         "d2ea657ec24995664a8ddc1bfb9c3fe317646c7bcd12517dee8478bc6c36244a",
		"202_channel_monitor_v2_full_table_permissions.sql":                          "7d944e39abd71fee4845dac933536f3f891fcfd7fb926e1187b4e8a49b6edc3e",
		"229_plugins.sql":          "b1e97991df385eba0f62426572d7d58a0ef5c96a876df356ba070cca68e88896",
		"230_plugin_artifacts.sql": "f33a1a3fdf1f0645a6813a5f87c344a18017193243133c4f45471dad3748d664",
	}
	for name, legacyChecksum := range cases {
		t.Run(name, func(t *testing.T) {
			body, err := migrations.FS.ReadFile(name)
			require.NoError(t, err)
			digest := sha256.Sum256([]byte(strings.TrimSpace(string(body))))
			currentChecksum := hex.EncodeToString(digest[:])
			require.True(t, isMigrationChecksumCompatible(name, legacyChecksum, currentChecksum))
			require.True(t, isMigrationChecksumCompatible(name, currentChecksum, currentChecksum))
			require.False(t, isMigrationChecksumCompatible(name, "unknown-checksum", currentChecksum))
			require.False(t, isMigrationChecksumCompatible(name, legacyChecksum, "unrecognized-file-content"))
		})
	}
}
