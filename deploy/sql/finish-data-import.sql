DO $$
DECLARE source_actor uuid; target_actor uuid;
BEGIN
  IF (SELECT count(*) FROM admin_account) <> 1 OR (SELECT count(*) FROM imported_admin) <> 1
    OR EXISTS (SELECT 1 FROM imported_admin WHERE role <> 'ADMIN' OR status <> 'ACTIVE')
    OR EXISTS (SELECT 1 FROM admin_account WHERE role <> 'ADMIN' OR status <> 'ACTIVE') THEN
    RAISE EXCEPTION 'Import requires one source administrator and one active server administrator';
  END IF;
  SELECT id INTO source_actor FROM admin_account;
  SELECT id INTO target_actor FROM imported_admin;
  IF source_actor <> target_actor THEN
    UPDATE admin_account SET login_name = 'import-' || id, login_name_normalized = 'import-' || id WHERE id = source_actor;
    INSERT INTO admin_account SELECT * FROM imported_admin;
    UPDATE media_asset SET uploaded_by = target_actor WHERE uploaded_by = source_actor;
    UPDATE content_entry SET created_by = target_actor WHERE created_by = source_actor;
    UPDATE content_entry SET updated_by = target_actor WHERE updated_by = source_actor;
    UPDATE content_revision SET created_by = target_actor WHERE created_by = source_actor;
    UPDATE map_selection SET actor_id = target_actor WHERE actor_id = source_actor;
    UPDATE admin_audit_event SET actor_id = target_actor WHERE actor_id = source_actor;
    DELETE FROM admin_account WHERE id = source_actor;
  ELSE
    UPDATE admin_account a SET
      login_name = s.login_name, login_name_normalized = s.login_name_normalized,
      password_hash = s.password_hash, display_name = s.display_name, role = s.role, status = s.status,
      password_changed_at = s.password_changed_at, last_login_at = s.last_login_at,
      created_at = s.created_at, updated_at = s.updated_at, lock_version = s.lock_version
    FROM imported_admin s WHERE a.id = s.id;
  END IF;
END $$;
CREATE TEMP TABLE imported_media (
  id uuid PRIMARY KEY, source_key text NOT NULL, target_key text NOT NULL UNIQUE,
  source_etag text NOT NULL, target_etag text NOT NULL, size_bytes bigint NOT NULL
);
COPY imported_media FROM STDIN WITH (FORMAT csv);
