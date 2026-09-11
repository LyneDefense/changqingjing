ALTER TABLE app_user
    ADD COLUMN profile_onboarding_completed_at timestamptz;

ALTER TABLE media_asset
    ADD COLUMN uploaded_by_app_user uuid REFERENCES app_user (id) ON DELETE CASCADE;

ALTER TABLE media_asset
    ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE media_asset
    ADD CONSTRAINT media_asset_single_uploader_ck CHECK (
        (uploaded_by IS NOT NULL) <> (uploaded_by_app_user IS NOT NULL)
    );

CREATE INDEX media_asset_uploaded_by_app_user_idx
    ON media_asset (uploaded_by_app_user)
    WHERE uploaded_by_app_user IS NOT NULL;
