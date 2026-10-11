-- Preserve plugin data when adopting the token namespace. This runs before 229/230
-- so installations that have applied 229 but not 230 can upgrade as well.
DO $migration$
DECLARE
    schema_name TEXT := current_schema();
    candidates TEXT[];
    legacy_installations TEXT;
    legacy_bindings TEXT;
    legacy_prefix TEXT;
    installation_oid OID;
    binding_oid OID;
    object_record RECORD;
    renamed_object TEXT;
BEGIN
    -- Only databases with the exact historical plugin migration are eligible.
    IF NOT EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE filename = '229_plugins.sql'
          AND checksum = 'b1e97991df385eba0f62426572d7d58a0ef5c96a876df356ba070cca68e88896'
    ) THEN
        RETURN;
    END IF;

    SELECT array_agg(c.relname ORDER BY c.relname)
    INTO candidates
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = schema_name
      AND c.relkind = 'r'
      AND c.relname ~ '^.+_plugin_installations$'
      AND c.relname <> 'token_plugin_installations'
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(ARRAY[
              'id', 'plugin_key', 'name', 'version', 'description', 'author',
              'manifest', 'artifact_path', 'install_path', 'binary_path',
              'binary_sha256', 'signature_status', 'state', 'config_encrypted',
              'last_error', 'installed_by', 'installed_at', 'enabled_at', 'updated_at'
          ]) required(column_name)
          WHERE NOT EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid AND a.attname = required.column_name
                AND a.attnum > 0 AND NOT a.attisdropped
          )
      );

    IF cardinality(candidates) IS NULL
       AND to_regclass(format('%I.token_plugin_installations', schema_name)) IS NOT NULL
       AND to_regclass(format('%I.token_plugin_bindings', schema_name)) IS NOT NULL THEN
        RETURN;
    END IF;
    IF cardinality(candidates) IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'token plugin migration requires exactly one recognized legacy installation table';
    END IF;
    IF to_regclass(format('%I.token_plugin_installations', schema_name)) IS NOT NULL
       OR to_regclass(format('%I.token_plugin_bindings', schema_name)) IS NOT NULL THEN
        RAISE EXCEPTION 'token plugin migration found conflicting target tables; no data was changed';
    END IF;

    legacy_installations := candidates[1];
    legacy_prefix := left(legacy_installations, -length('_plugin_installations'));
    legacy_bindings := legacy_prefix || '_plugin_bindings';
    installation_oid := to_regclass(format('%I.%I', schema_name, legacy_installations));
    binding_oid := to_regclass(format('%I.%I', schema_name, legacy_bindings));

    IF binding_oid IS NULL OR EXISTS (
        SELECT 1
        FROM unnest(ARRAY[
            'id', 'plugin_id', 'capability', 'platform', 'account_type',
            'enabled', 'rollout_percent', 'created_at', 'updated_at'
        ]) required(column_name)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = binding_oid AND a.attname = required.column_name
              AND a.attnum > 0 AND NOT a.attisdropped
        )
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = binding_oid AND confrelid = installation_oid AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'token plugin migration could not verify the associated bindings table';
    END IF;

    EXECUTE format('ALTER TABLE %I.%I RENAME TO token_plugin_installations', schema_name, legacy_installations);
    EXECUTE format('ALTER TABLE %I.%I RENAME TO token_plugin_bindings', schema_name, legacy_bindings);

    -- PostgreSQL keeps rows and foreign keys intact when renaming relations.
    FOR object_record IN
        SELECT conrelid::regclass AS table_name, conname
        FROM pg_constraint
        WHERE conrelid IN (installation_oid, binding_oid)
          AND position(legacy_prefix IN conname) > 0
    LOOP
        renamed_object := replace(object_record.conname, legacy_prefix, 'token');
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', object_record.table_name, object_record.conname, renamed_object);
    END LOOP;

    FOR object_record IN
        SELECT c.oid::regclass AS object_name, c.relname
        FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE i.indrelid IN (installation_oid, binding_oid)
          AND position(legacy_prefix IN c.relname) > 0
    LOOP
        renamed_object := replace(object_record.relname, legacy_prefix, 'token');
        EXECUTE format('ALTER INDEX %s RENAME TO %I', object_record.object_name, renamed_object);
    END LOOP;

    FOR object_record IN
        SELECT c.oid::regclass AS object_name, c.relname
        FROM pg_class c JOIN pg_depend d ON d.objid = c.oid
        WHERE c.relkind = 'S' AND d.refobjid IN (installation_oid, binding_oid)
          AND d.deptype IN ('a', 'i')
          AND position(legacy_prefix IN c.relname) > 0
    LOOP
        renamed_object := replace(object_record.relname, legacy_prefix, 'token');
        EXECUTE format('ALTER SEQUENCE %s RENAME TO %I', object_record.object_name, renamed_object);
    END LOOP;

    -- Existing binaries use the former handshake/manifest contract. Preserve
    -- their packages and configuration, but require a newly signed token package.
    UPDATE token_plugin_bindings SET enabled = FALSE, updated_at = NOW();
    UPDATE token_plugin_installations
    SET state = 'incompatible', enabled_at = NULL,
        last_error = '插件需使用 token 协议重新打包并签名后上传。', updated_at = NOW();
END
$migration$;
