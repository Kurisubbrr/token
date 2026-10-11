//go:build integration

package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestTokenPluginNamespaceMigration(t *testing.T) {
	dsn := os.Getenv("TOKEN_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TOKEN_TEST_DATABASE_URL is required for isolated PostgreSQL migration tests")
	}
	migration, err := FS.ReadFile("228b_token_plugin_namespace.sql")
	require.NoError(t, err)
	pluginSchema, err := FS.ReadFile("229_plugins.sql")
	require.NoError(t, err)
	artifactSchema, err := FS.ReadFile("230_plugin_artifacts.sql")
	require.NoError(t, err)

	for _, scenario := range []string{"fresh", "before_artifact_migration", "with_artifact", "target_conflict", "ambiguous_legacy_tables", "unrecognized_checksum"} {
		t.Run(scenario, func(t *testing.T) {
			db, err := sql.Open("postgres", dsn)
			require.NoError(t, err)
			db.SetMaxOpenConns(1)
			db.SetMaxIdleConns(1)
			defer db.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			schema := pq.QuoteIdentifier(fmt.Sprintf("token_namespace_test_%d", time.Now().UnixNano()))
			_, err = db.ExecContext(ctx, "CREATE SCHEMA "+schema)
			require.NoError(t, err)
			defer db.ExecContext(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
			_, err = db.ExecContext(ctx, "SET search_path TO "+schema)
			require.NoError(t, err)
			_, err = db.ExecContext(ctx, "CREATE TABLE users (id BIGINT PRIMARY KEY); CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, checksum TEXT NOT NULL)")
			require.NoError(t, err)

			if scenario == "fresh" {
				_, err = db.ExecContext(ctx, string(migration))
				require.NoError(t, err)
				_, err = db.ExecContext(ctx, string(pluginSchema))
				require.NoError(t, err)
				_, err = db.ExecContext(ctx, string(artifactSchema))
				require.NoError(t, err)
				return
			}

			checksum := "b1e97991df385eba0f62426572d7d58a0ef5c96a876df356ba070cca68e88896"
			if scenario == "unrecognized_checksum" {
				checksum = "not-a-recognized-source"
			}
			_, err = db.ExecContext(ctx, "INSERT INTO schema_migrations VALUES ('229_plugins.sql', $1)", checksum)
			require.NoError(t, err)
			_, err = db.ExecContext(ctx, strings.ReplaceAll(string(pluginSchema), "token_", "legacy_"))
			require.NoError(t, err)
			_, err = db.ExecContext(ctx, `INSERT INTO legacy_plugin_installations
				(plugin_key, name, version, artifact_path, install_path, binary_path, binary_sha256, state, config_encrypted)
				VALUES ('test.plugin', 'test', '1.0.0', '/package', '/install', '/binary', 'digest', 'enabled', 'keep-encrypted');
				INSERT INTO legacy_plugin_bindings (plugin_id, capability, platform, account_type, enabled)
				VALUES (1, 'test', 'openai', 'oauth', TRUE)`)
			require.NoError(t, err)
			if scenario == "with_artifact" {
				_, err = db.ExecContext(ctx, strings.ReplaceAll(string(artifactSchema), "token_", "legacy_"))
				require.NoError(t, err)
				_, err = db.ExecContext(ctx, "UPDATE legacy_plugin_installations SET artifact_data = $1", []byte("signed-package"))
				require.NoError(t, err)
			}
			if scenario == "target_conflict" {
				_, err = db.ExecContext(ctx, string(pluginSchema))
				require.NoError(t, err)
			}
			if scenario == "ambiguous_legacy_tables" {
				_, err = db.ExecContext(ctx, strings.ReplaceAll(string(pluginSchema), "token_", "other_"))
				require.NoError(t, err)
			}

			_, err = db.ExecContext(ctx, string(migration))
			if scenario == "target_conflict" || scenario == "ambiguous_legacy_tables" {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if scenario == "target_conflict" || scenario == "ambiguous_legacy_tables" || scenario == "unrecognized_checksum" {
				var state string
				require.NoError(t, db.QueryRowContext(ctx, "SELECT state FROM legacy_plugin_installations WHERE id = 1").Scan(&state))
				require.Equal(t, "enabled", state)
				return
			}

			var state, encrypted string
			require.NoError(t, db.QueryRowContext(ctx, "SELECT state, config_encrypted FROM token_plugin_installations WHERE id = 1").Scan(&state, &encrypted))
			require.Equal(t, "incompatible", state)
			require.Equal(t, "keep-encrypted", encrypted)
			var enabled bool
			require.NoError(t, db.QueryRowContext(ctx, "SELECT enabled FROM token_plugin_bindings WHERE plugin_id = 1").Scan(&enabled))
			require.False(t, enabled)
			if scenario == "with_artifact" {
				var artifact []byte
				require.NoError(t, db.QueryRowContext(ctx, "SELECT artifact_data FROM token_plugin_installations WHERE id = 1").Scan(&artifact))
				require.Equal(t, []byte("signed-package"), artifact)
			} else {
				_, err = db.ExecContext(ctx, string(artifactSchema))
				require.NoError(t, err)
			}
			// Reapplying the migration must preserve the successfully renamed schema.
			_, err = db.ExecContext(ctx, string(migration))
			require.NoError(t, err)
		})
	}
}
