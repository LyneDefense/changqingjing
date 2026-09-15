SELECT set_config('changqingjing.import_prefix', :'import_prefix', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM imported_media) <> (SELECT count(*) FROM media_asset)
    OR EXISTS (
      SELECT 1 FROM media_asset a LEFT JOIN imported_media m ON m.id = a.id
      WHERE m.id IS NULL OR a.status <> 'READY' OR a.object_key <> m.source_key
        OR btrim(a.etag, '"') <> m.source_etag OR a.size_bytes <> m.size_bytes
        OR left(m.target_key, length(current_setting('changqingjing.import_prefix') || '/imports/')) <> current_setting('changqingjing.import_prefix') || '/imports/'
        OR m.target_key = m.source_key OR length(m.target_etag) = 0
    ) THEN
    RAISE EXCEPTION 'COS mapping does not match the restored source snapshot';
  END IF;
END $$;
UPDATE media_asset a SET object_key = m.target_key, etag = m.target_etag FROM imported_media m WHERE a.id = m.id;
-- Sessions, access-token caches and map-selection authorization are environment-specific.
DELETE FROM app_session;
DELETE FROM spring_session_attributes;
DELETE FROM spring_session;
DELETE FROM wechat_api_credential;
DELETE FROM map_selection;
COMMIT;
