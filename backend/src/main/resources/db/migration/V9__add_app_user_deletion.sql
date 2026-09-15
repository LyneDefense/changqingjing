ALTER TABLE app_user ADD COLUMN deleted_at timestamptz;

ALTER TABLE app_user ADD CONSTRAINT app_user_deleted_status_ck
    CHECK (deleted_at IS NULL OR status = 'DISABLED');
