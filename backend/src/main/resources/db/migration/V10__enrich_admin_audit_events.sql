ALTER TABLE admin_audit_event
    ADD COLUMN actor_login_name varchar(100),
    ADD COLUMN actor_display_name varchar(100),
    ADD COLUMN target_name varchar(255),
    ADD COLUMN module varchar(40),
    ADD COLUMN client_ip varchar(100),
    ADD COLUMN user_agent varchar(512),
    ADD COLUMN login_batch_id uuid,
    ADD COLUMN affects_online boolean,
    ADD COLUMN change_summary jsonb,
    ADD COLUMN failure_code varchar(100),
    ADD CONSTRAINT admin_audit_change_summary_ck
        CHECK (change_summary IS NULL OR jsonb_typeof(change_summary) = 'array');

-- Historical request metadata cannot be reconstructed. Leave it NULL.
CREATE INDEX admin_audit_event_module_created_idx ON admin_audit_event (module, created_at DESC);
CREATE INDEX admin_audit_event_login_batch_idx ON admin_audit_event (login_batch_id, created_at DESC)
    WHERE login_batch_id IS NOT NULL;
