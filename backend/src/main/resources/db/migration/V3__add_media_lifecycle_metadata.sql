ALTER TABLE media_asset
    ADD COLUMN upload_expires_at timestamptz,
    ADD COLUMN failure_code varchar(100),
    ADD COLUMN verification_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN cleanup_attempts integer NOT NULL DEFAULT 0;

UPDATE media_asset
SET upload_expires_at = created_at + interval '15 minutes'
WHERE upload_expires_at IS NULL;

ALTER TABLE media_asset
    ALTER COLUMN upload_expires_at SET NOT NULL,
    ADD CONSTRAINT media_asset_verification_attempts_ck CHECK (verification_attempts >= 0),
    ADD CONSTRAINT media_asset_cleanup_attempts_ck CHECK (cleanup_attempts >= 0),
    ADD CONSTRAINT media_asset_ready_metadata_ck CHECK (
        status <> 'READY' OR (etag IS NOT NULL AND verified_at IS NOT NULL)
    );

CREATE INDEX media_asset_cleanup_idx
    ON media_asset (upload_expires_at, status)
    WHERE status IN ('UPLOADING', 'VERIFYING', 'FAILED', 'PENDING_DELETE');
