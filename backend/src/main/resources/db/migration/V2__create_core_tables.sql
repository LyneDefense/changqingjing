CREATE TABLE admin_account (
    id uuid PRIMARY KEY,
    login_name varchar(100) NOT NULL,
    login_name_normalized varchar(100) NOT NULL,
    password_hash varchar(255) NOT NULL,
    display_name varchar(100) NOT NULL,
    role varchar(20) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    password_changed_at timestamptz NOT NULL,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    lock_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT admin_account_login_name_normalized_uk UNIQUE (login_name_normalized),
    CONSTRAINT admin_account_login_name_normalized_ck
        CHECK (login_name_normalized = lower(btrim(login_name_normalized))),
    CONSTRAINT admin_account_role_ck CHECK (role IN ('ADMIN', 'OPERATOR')),
    CONSTRAINT admin_account_status_ck CHECK (status IN ('ACTIVE', 'DISABLED')),
    CONSTRAINT admin_account_lock_version_ck CHECK (lock_version >= 0)
);

CREATE INDEX admin_account_status_role_idx ON admin_account (status, role);

CREATE TABLE app_user (
    id uuid PRIMARY KEY,
    display_name varchar(100),
    avatar_media_id uuid,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    registered_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    lock_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT app_user_status_ck CHECK (status IN ('ACTIVE', 'DISABLED')),
    CONSTRAINT app_user_lock_version_ck CHECK (lock_version >= 0)
);

CREATE INDEX app_user_registered_at_idx ON app_user (registered_at DESC);
CREATE INDEX app_user_status_idx ON app_user (status);

CREATE TABLE wechat_identity (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    app_id varchar(64) NOT NULL,
    openid varchar(128) NOT NULL,
    unionid varchar(128),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_verified_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wechat_identity_app_openid_uk UNIQUE (app_id, openid)
);

CREATE INDEX wechat_identity_user_idx ON wechat_identity (user_id);
CREATE INDEX wechat_identity_unionid_idx ON wechat_identity (unionid) WHERE unionid IS NOT NULL;

CREATE TABLE user_phone (
    user_id uuid PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    phone_ciphertext bytea NOT NULL,
    phone_query_digest bytea NOT NULL,
    masked_phone varchar(32) NOT NULL,
    encryption_key_version smallint NOT NULL,
    bound_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_phone_key_version_ck CHECK (encryption_key_version > 0)
);

CREATE INDEX user_phone_query_digest_idx ON user_phone (phone_query_digest);

CREATE TABLE app_session (
    id uuid PRIMARY KEY,
    token_digest bytea NOT NULL,
    user_id uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    CONSTRAINT app_session_token_digest_uk UNIQUE (token_digest),
    CONSTRAINT app_session_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT app_session_revoked_at_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX app_session_user_active_idx ON app_session (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX app_session_expiry_idx ON app_session (expires_at);

CREATE TABLE wechat_api_credential (
    config_key varchar(100) PRIMARY KEY,
    credential_ciphertext bytea NOT NULL,
    encryption_key_version smallint NOT NULL,
    expires_at timestamptz NOT NULL,
    refresh_status varchar(20) NOT NULL DEFAULT 'READY',
    refresh_locked_at timestamptz,
    refresh_locked_by varchar(100),
    updated_at timestamptz NOT NULL DEFAULT now(),
    lock_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT wechat_api_credential_key_version_ck CHECK (encryption_key_version > 0),
    CONSTRAINT wechat_api_credential_status_ck
        CHECK (refresh_status IN ('READY', 'REFRESHING', 'FAILED')),
    CONSTRAINT wechat_api_credential_lock_version_ck CHECK (lock_version >= 0)
);

CREATE TABLE media_asset (
    id uuid PRIMARY KEY,
    object_key varchar(1024) NOT NULL,
    original_filename varchar(255) NOT NULL,
    media_type varchar(20) NOT NULL,
    content_type varchar(255) NOT NULL,
    size_bytes bigint NOT NULL,
    etag varchar(255),
    status varchar(30) NOT NULL DEFAULT 'UPLOADING',
    purpose varchar(50) NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES admin_account (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    verified_at timestamptz,
    deletion_requested_at timestamptz,
    deleted_at timestamptz,
    CONSTRAINT media_asset_object_key_uk UNIQUE (object_key),
    CONSTRAINT media_asset_type_ck CHECK (media_type IN ('IMAGE', 'VIDEO')),
    CONSTRAINT media_asset_size_ck CHECK (size_bytes >= 0),
    CONSTRAINT media_asset_status_ck
        CHECK (status IN ('UPLOADING', 'VERIFYING', 'READY', 'FAILED', 'PENDING_DELETE', 'DELETED'))
);

CREATE INDEX media_asset_status_created_idx ON media_asset (status, created_at);
CREATE INDEX media_asset_uploaded_by_idx ON media_asset (uploaded_by);

ALTER TABLE app_user
    ADD CONSTRAINT app_user_avatar_media_fk
    FOREIGN KEY (avatar_media_id) REFERENCES media_asset (id) ON DELETE SET NULL;

CREATE TABLE content_entry (
    id uuid PRIMARY KEY,
    kind varchar(30) NOT NULL,
    business_key varchar(100),
    draft_revision_id uuid,
    published_revision_id uuid,
    visibility varchar(20) NOT NULL DEFAULT 'HIDDEN',
    lock_version bigint NOT NULL DEFAULT 0,
    first_published_at timestamptz,
    created_by uuid NOT NULL REFERENCES admin_account (id),
    updated_by uuid NOT NULL REFERENCES admin_account (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_entry_kind_ck
        CHECK (kind IN ('HOME_VIDEO', 'COMPANY', 'SCENIC', 'PRODUCT', 'PRODUCT_CATEGORY', 'COOPERATION')),
    CONSTRAINT content_entry_visibility_ck CHECK (visibility IN ('HIDDEN', 'PUBLISHED')),
    CONSTRAINT content_entry_lock_version_ck CHECK (lock_version >= 0),
    CONSTRAINT content_entry_published_visibility_ck
        CHECK (visibility <> 'PUBLISHED' OR published_revision_id IS NOT NULL),
    CONSTRAINT content_entry_business_key_uk UNIQUE (kind, business_key)
);

CREATE INDEX content_entry_kind_visibility_idx ON content_entry (kind, visibility);
CREATE INDEX content_entry_updated_at_idx ON content_entry (updated_at DESC);

CREATE TABLE content_revision (
    id uuid PRIMARY KEY,
    entry_id uuid NOT NULL REFERENCES content_entry (id) ON DELETE CASCADE,
    revision_no integer NOT NULL,
    schema_version integer NOT NULL DEFAULT 1,
    title varchar(255) NOT NULL,
    summary text,
    cover_media_id uuid REFERENCES media_asset (id) ON DELETE RESTRICT,
    category_entry_id uuid REFERENCES content_entry (id) ON DELETE RESTRICT,
    display_order integer NOT NULL DEFAULT 0,
    longitude numeric(10,7),
    latitude numeric(9,7),
    coordinate_system varchar(20),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL REFERENCES admin_account (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_revision_entry_revision_uk UNIQUE (entry_id, revision_no),
    CONSTRAINT content_revision_entry_id_uk UNIQUE (entry_id, id),
    CONSTRAINT content_revision_revision_no_ck CHECK (revision_no > 0),
    CONSTRAINT content_revision_schema_version_ck CHECK (schema_version > 0),
    CONSTRAINT content_revision_display_order_ck CHECK (display_order >= 0),
    CONSTRAINT content_revision_longitude_ck CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT content_revision_latitude_ck CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT content_revision_coordinates_ck CHECK (
        (longitude IS NULL AND latitude IS NULL AND coordinate_system IS NULL)
        OR
        (longitude IS NOT NULL AND latitude IS NOT NULL AND coordinate_system = 'GCJ02')
    ),
    CONSTRAINT content_revision_payload_ck CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX content_revision_entry_created_idx ON content_revision (entry_id, created_at DESC);
CREATE INDEX content_revision_category_idx ON content_revision (category_entry_id)
    WHERE category_entry_id IS NOT NULL;

ALTER TABLE content_entry
    ADD CONSTRAINT content_entry_draft_revision_fk
    FOREIGN KEY (id, draft_revision_id)
    REFERENCES content_revision (entry_id, id)
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE content_entry
    ADD CONSTRAINT content_entry_published_revision_fk
    FOREIGN KEY (id, published_revision_id)
    REFERENCES content_revision (entry_id, id)
    DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE content_revision_media (
    revision_id uuid NOT NULL REFERENCES content_revision (id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES media_asset (id) ON DELETE RESTRICT,
    usage varchar(50) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    PRIMARY KEY (revision_id, usage, display_order),
    CONSTRAINT content_revision_media_display_order_ck CHECK (display_order >= 0)
);

CREATE INDEX content_revision_media_media_idx ON content_revision_media (media_id);

CREATE TABLE scenic_stats (
    scenic_entry_id uuid PRIMARY KEY REFERENCES content_entry (id) ON DELETE CASCADE,
    view_count bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT scenic_stats_view_count_ck CHECK (view_count >= 0)
);

CREATE TABLE scenic_view_receipt (
    scenic_entry_id uuid NOT NULL REFERENCES content_entry (id) ON DELETE CASCADE,
    view_id uuid NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (scenic_entry_id, view_id)
);

CREATE INDEX scenic_view_receipt_received_at_idx ON scenic_view_receipt (received_at);

CREATE TABLE admin_audit_event (
    id uuid PRIMARY KEY,
    actor_id uuid REFERENCES admin_account (id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,
    target_type varchar(100) NOT NULL,
    target_id uuid,
    result varchar(20) NOT NULL,
    trace_id varchar(100) NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_audit_event_result_ck CHECK (result IN ('SUCCESS', 'FAILURE')),
    CONSTRAINT admin_audit_event_detail_ck CHECK (jsonb_typeof(detail) = 'object')
);

CREATE INDEX admin_audit_event_actor_created_idx ON admin_audit_event (actor_id, created_at DESC);
CREATE INDEX admin_audit_event_created_at_idx ON admin_audit_event (created_at DESC);
CREATE INDEX admin_audit_event_target_idx ON admin_audit_event (target_type, target_id);

CREATE TABLE spring_session (
    primary_id char(36) NOT NULL,
    session_id char(36) NOT NULL,
    creation_time bigint NOT NULL,
    last_access_time bigint NOT NULL,
    max_inactive_interval integer NOT NULL,
    expiry_time bigint NOT NULL,
    principal_name varchar(100),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);

CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id char(36) NOT NULL,
    attribute_name varchar(200) NOT NULL,
    attribute_bytes bytea NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id)
        REFERENCES spring_session (primary_id) ON DELETE CASCADE
);
